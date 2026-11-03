import { createCipheriv, createDecipheriv, createHash } from 'node:crypto'
import crypto from 'crypto-browserify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const lite = { name: 'lite', appid: 3116, clientver: 11440 }
const standard = { name: 'standard', appid: 1005, clientver: 20489 }
const originalCookie = {
  KUGOU_API_GUID: 'test-guid', KUGOU_API_MID: 'test-mid',
  userid: '42', token: 'test-token', dfid: '-',
  __raw: 'userid=42; token=test-token; dfid=-; kg_dfid=-',
}
const digest = createHash('md5').update('012345').digest('hex')
const aesKey = Buffer.from(digest.slice(0, 16))
const iv = Buffer.from(digest.slice(16))
const encryptedResponse = (dfid) => {
  const cipher = createCipheriv('aes-128-cbc', aesKey, iv)
  return Uint8Array.from(Buffer.concat([
    cipher.update(JSON.stringify({ status: 1, data: { dfid } })), cipher.final(),
  ])).buffer
}

beforeEach(() => vi.resetModules())
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('kugou device lifecycle', () => {
  it('loads without generating a device before a request needs one', async () => {
    vi.spyOn(crypto, 'randomBytes').mockImplementation(() => { throw new Error('Randomness requested during module loading') })
    await expect(import('./device.js')).resolves.toHaveProperty('prepareKugouAudioCookie')
  })

  it('shares concurrent registration and synchronizes the returned fingerprint without mutating the input', async () => {
    const { prepareKugouAudioCookie, registerKugouDevice } = await import('./device.js')
    vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from([0, 1, 2, 3, 4, 5]))
    let complete
    const pending = new Promise((resolve) => { complete = resolve })
    const request = vi.fn(() => pending)
    const cookie = prepareKugouAudioCookie(originalCookie, lite)
    const first = registerKugouDevice(cookie, lite, request)
    const second = registerKugouDevice(cookie, lite, request)

    expect(request).toHaveBeenCalledTimes(1)
    const [path, options] = request.mock.calls[0]
    expect(path).toBe('/risk/v3/r_register_dev')
    const decipher = createDecipheriv('aes-128-cbc', aesKey, iv)
    const payload = JSON.parse(Buffer.concat([
      decipher.update(Buffer.from(options.body, 'base64')), decipher.final(),
    ]).toString('utf8'))
    expect(payload).toMatchObject({ uuid: 'test-guid', imei: 'test-guid', brand: 'Redmi', batteryLevel: 100 })
    expect(options.profile.name).toBe('lite')

    complete(encryptedResponse('shared-dfid'))
    const results = await Promise.all([first, second])
    for (const result of results) {
      expect(result.dfid).toBe('shared-dfid')
      expect(result.__raw).toContain('dfid=shared-dfid')
      expect(result.__raw).not.toContain('dfid=-')
      expect(result.__raw).not.toContain('kg_dfid=')
    }
    expect(originalCookie.dfid).toBe('-')
    expect(originalCookie.__raw).toContain('dfid=-')
  })

  it('allows another registration after a failed request', async () => {
    const { prepareKugouAudioCookie, registerKugouDevice } = await import('./device.js')
    vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from([0, 1, 2, 3, 4, 5]))
    const request = vi.fn()
      .mockRejectedValueOnce(new Error('registration unavailable'))
      .mockResolvedValueOnce(encryptedResponse('recovered-dfid'))
    const cookie = prepareKugouAudioCookie(originalCookie, lite)

    await expect(registerKugouDevice(cookie, lite, request)).rejects.toThrow('registration unavailable')
    expect((await registerKugouDevice(cookie, lite, request)).dfid).toBe('recovered-dfid')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it.each([{}, true, 42])('rejects a non-string fingerprint without poisoning the cache: %j', async (invalidDfid) => {
    const { prepareKugouAudioCookie, registerKugouDevice } = await import('./device.js')
    vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from([0, 1, 2, 3, 4, 5]))
    const request = vi.fn()
      .mockResolvedValueOnce(encryptedResponse(invalidDfid))
      .mockResolvedValueOnce(encryptedResponse('valid-dfid'))
    const cookie = prepareKugouAudioCookie(originalCookie, lite)

    await expect(registerKugouDevice(cookie, lite, request)).rejects.toThrow('有效 dfid')
    expect((await registerKugouDevice(cookie, lite, request)).dfid).toBe('valid-dfid')
  })

  it('reuses fresh fingerprints and replaces them after the cache expires', async () => {
    const { prepareKugouAudioCookie, registerKugouDevice } = await import('./device.js')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from([0, 1, 2, 3, 4, 5]))
    const request = vi.fn()
      .mockResolvedValueOnce(encryptedResponse('first-dfid'))
      .mockResolvedValueOnce(encryptedResponse('second-dfid'))
    await registerKugouDevice(prepareKugouAudioCookie(originalCookie, lite), lite, request)

    const cached = prepareKugouAudioCookie(originalCookie, lite)
    expect((await registerKugouDevice(cached, lite, request)).dfid).toBe('first-dfid')
    expect(request).toHaveBeenCalledTimes(1)

    vi.setSystemTime(Date.now() + 6 * 60 * 60 * 1000 + 1)
    const expired = prepareKugouAudioCookie(originalCookie, lite)
    expect((await registerKugouDevice(expired, lite, request)).dfid).toBe('second-dfid')
    expect(request).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['platform', { ...originalCookie }, standard],
    ['account', { ...originalCookie, userid: '43' }, lite],
    ['token', { ...originalCookie, token: 'new-token' }, lite],
  ])('isolates cached fingerprints when the %s changes', async (_, changedCookie, changedProfile) => {
    const { prepareKugouAudioCookie, registerKugouDevice } = await import('./device.js')
    vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from([0, 1, 2, 3, 4, 5]))
    const request = vi.fn()
      .mockResolvedValueOnce(encryptedResponse('original-dfid'))
      .mockResolvedValueOnce(encryptedResponse('isolated-dfid'))
    await registerKugouDevice(prepareKugouAudioCookie(originalCookie, lite), lite, request)
    const changed = prepareKugouAudioCookie(changedCookie, changedProfile)

    expect((await registerKugouDevice(changed, changedProfile, request)).dfid).toBe('isolated-dfid')
    expect(request).toHaveBeenCalledTimes(2)
  })
})
