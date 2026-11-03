import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCipheriv, createHash } from 'node:crypto'
import crypto from 'crypto-browserify'
import kugou from './index.js'

const provider = {}
kugou.register({ register: (_, value) => Object.assign(provider, value) })
const response = (data) => ({ ok: true, json: async () => data })
const registeredDeviceResponse = (dfid) => {
  const digest = createHash('md5').update('012345').digest('hex')
  const cipher = createCipheriv('aes-128-cbc', Buffer.from(digest.slice(0, 16)), Buffer.from(digest.slice(16)))
  return new Response(Buffer.concat([cipher.update(JSON.stringify({ status: 1, data: { dfid } })), cipher.final()]))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('kugou audio requests', () => {
  it('requests full tracks with the tracker client version for a logged-in lite account', async () => {
    const fetchMock = vi.fn(async () => response({ error_code: 0, url: ['https://audio.example/full.mp3'], bitRate: 128000 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await provider.handle('url', 'ABCDEF,123', 'token=lite-token;userid=42')).toMatchObject({
      url: 'https://audio.example/full.mp3', quality: '标准',
    })
    const params = fetchMock.mock.calls[0][0].searchParams
    expect(params.get('appid')).toBe('3116')
    expect(params.get('clientver')).toBe('11430')
    expect(params.get('IsFreePart')).toBe('0')
    expect(params.get('album_audio_id')).toBe('123')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each(['dfid', 'kg_dfid'])('preserves %s while removing credentials from the alternate profile', async (field) => {
    const fetchMock = vi.fn(async (url) => {
      if (url.pathname === '/v1/user_verify') return response({ status: 1, data: {} })
      return url.searchParams.get('appid') === '3116'
        ? response({ error_code: 20028, msg: '本次请求需要验证' })
        : response({ error_code: 0, url: ['https://audio.example/fallback.mp3'], bitRate: 320000 })
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await provider.handle('url', 'ABCDEF', `token=lite-token;userid=42;${field}=registered-dfid;KUGOU_API_MID=device-mid`)).toMatchObject({
      url: 'https://audio.example/fallback.mp3', quality: '极高',
    })
    const [url, options] = fetchMock.mock.calls.find(([url]) => url.searchParams.get('appid') === '1005')
    expect(url.searchParams.get('appid')).toBe('1005')
    expect(url.searchParams.get('dfid')).toBe('registered-dfid')
    expect(url.searchParams.get('mid')).toBe('device-mid')
    expect(url.searchParams.has('token')).toBe(false)
    expect(url.searchParams.has('userid')).toBe(false)
    expect(options.headers.dfid).toBe('registered-dfid')
    expect(options.headers.Cookie).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retains the cover when both profiles return no playable audio', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response({ error_code: 0, status: 3, url: [], trans_param: { union_cover: 'http://img.example/{size}/cover.jpg' } }))
      .mockResolvedValueOnce(response({ error_code: 0, status: 3, url: [], fail_process: ['vip'] })))

    expect(await provider.handle('pic', 'ABCDEF')).toBe('https://img.example/400/cover.jpg')
  })

  it('requests the upstream magic quality for human and accompaniment tracks', async () => {
    const fetchMock = vi.fn(async () => response({
      error_code: 0, url: ['https://audio.example/track.mkv'], quality: 'magic_acappella',
    }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await provider.handle('url', 'ABCDEF', '', { quality: 'acappella' })).toMatchObject({
      url: 'https://audio.example/track.mkv', quality: '人声伴奏',
    })
    expect(fetchMock.mock.calls[0][0].searchParams.get('quality')).toBe('magic_acappella')
  })

  it('uses the anonymous standard profile first and retries lite at most once', async () => {
    const fetchMock = vi.fn(async () => response({ error_code: 0, status: 3, url: [], fail_process: ['pkg', 'buy'] }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await provider.handle('url', 'ABCDEF')).toMatchObject({ url: '', reason: '版权受限 / 需购买/会员' })
    expect(fetchMock.mock.calls.map(([url]) => url.searchParams.get('appid'))).toEqual(['1005', '3116'])
    expect(fetchMock.mock.calls[1][0].searchParams.get('IsFreePart')).toBe('0')
  })

  it('honors an explicitly selected standard account without sending its credentials to lite', async () => {
    const fetchMock = vi.fn(async () => response({ error_code: 0, status: 3, url: [] }))
    vi.stubGlobal('fetch', fetchMock)

    await provider.handle('url', 'ABCDEF', 'KUGOU_API_PLATFORM=standard;token=standard-token;userid=42')
    expect(fetchMock.mock.calls[0][0].searchParams.get('token')).toBe('standard-token')
    expect(fetchMock.mock.calls[0][0].searchParams.get('appid')).toBe('1005')
    const [alternate] = fetchMock.mock.calls.find(([url]) => url.searchParams.get('appid') === '3116')
    expect(alternate.searchParams.has('token')).toBe(false)
  })

  it('propagates unexpected upstream errors instead of silently switching accounts', async () => {
    const fetchMock = vi.fn(async () => response({ error_code: 401, msg: 'unexpected failure' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(provider.handle('url', 'ABCDEF')).rejects.toThrow('unexpected failure')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each(['lite', 'standard'])('uses the current Auth chain when legacy playback misses for a %s account', async (platform) => {
    const fetchMock = vi.fn(async (url) => {
      if (url.pathname === '/v5/url') return response({ status: 3, url: [], img: 'https://img.example/auth-cover.jpg' })
      if (url.pathname === '/v1/user_verify') return response({ status: 1, data: { auth: 'account-auth' } })
      if (url.pathname === '/v1/authorization') return response({ status: 1, data: { auth: 'track-auth', open_time: 1700000000 } })
      if (url.pathname === '/tracker/v5/url') return response({
        status: 1, url: ['https://audio.example/auth.flac'], extName: 'flac', timeLength: 240,
      })
      throw new Error('Unexpected request')
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await provider.handle('url', 'ABCDEF,123', `KUGOU_API_PLATFORM=${platform};token=account-token;userid=42;dfid=registered-dfid`, { quality: 'flac' })).toMatchObject({
      url: 'https://audio.example/auth.flac', quality: '无损', duration: 240, pic: 'https://img.example/auth-cover.jpg',
    })
    expect(fetchMock.mock.calls.map(([url]) => url.pathname)).toEqual([
      '/v5/url', '/v1/user_verify', '/v1/authorization', '/tracker/v5/url',
    ])
    const [authorization, authorizationOptions] = fetchMock.mock.calls[2]
    expect(authorization.searchParams.get('authorization')).toBe('account-auth')
    expect(authorization.searchParams.get('album_audio_id')).toBe('123')
    expect(authorization.searchParams.get('clientver')).toBe('11561')
    expect(authorizationOptions.headers['x-router']).toBe('trackercdngz.kugou.com')
    const [tracker] = fetchMock.mock.calls[3]
    expect(tracker.searchParams.get('auth')).toBe('track-auth')
    expect(tracker.searchParams.get('open_time')).toBe('1700000000')
    expect(tracker.searchParams.get('quality')).toBe('flac')
    expect(tracker.searchParams.get('clientver')).toBe('11561')
    expect(tracker.searchParams.get('token')).toBe('account-token')
    expect(fetchMock.mock.calls.every(([url]) => url.searchParams.get('appid') === (platform === 'lite' ? '3116' : '1005'))).toBe(true)
  })

  it('reuses account auth from the cookie and ignores incomplete track grants', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.pathname === '/v1/user_verify') throw new Error('Account auth already exists')
      if (url.pathname === '/v1/authorization') return response({ status: 1, data: { open_time: 1700000000 } })
      return response({ status: 3, url: [], fail_process: ['vip'] })
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await provider.handle('url', 'ABCDEF', 'token=lite-token;userid=42;auth=saved-auth;dfid=registered-dfid')).toMatchObject({
      url: '', reason: '需会员',
    })
    expect(fetchMock.mock.calls.map(([url]) => url.pathname)).toEqual(['/v5/url', '/v1/authorization', '/v5/url'])
    expect(fetchMock.mock.calls[1][0].searchParams.get('authorization')).toBe('saved-auth')
    expect(fetchMock.mock.calls[2][1].headers.Cookie).toBeUndefined()
  })

  it('registers a missing device only after verification is required and reuses its fingerprint', async () => {
    vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from([0, 1, 2, 3, 4, 5]))
    const fetchMock = vi.fn(async (url) => {
      if (url.pathname === '/risk/v3/r_register_dev') return registeredDeviceResponse('new-registered-dfid')
      if (url.searchParams.get('dfid') !== 'new-registered-dfid') return response({ error_code: 20028, msg: '本次请求需要验证' })
      return response({ status: 1, url: ['https://audio.example/registered.mp3'], bitRate: 128000 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const cookie = 'KUGOU_API_MID=registration-test-mid;KUGOU_API_GUID=registration-test-guid'

    expect(await provider.handle('url', 'ABCDEF', cookie)).toMatchObject({ url: 'https://audio.example/registered.mp3' })
    expect(await provider.handle('url', 'ABCDEF', cookie)).toMatchObject({ url: 'https://audio.example/registered.mp3' })
    expect(fetchMock.mock.calls.map(([url]) => url.pathname)).toEqual([
      '/v5/url', '/risk/v3/r_register_dev', '/v5/url', '/v5/url',
    ])
    const [registration, options] = fetchMock.mock.calls[1]
    expect(registration.origin).toBe('https://userservice.kugou.com')
    expect(registration.searchParams.get('mid')).toBe('registration-test-mid')
    expect(registration.searchParams.get('clientver')).toBe('20489')
    expect(registration.searchParams.get('p')).toMatch(/^[a-f0-9]{256}$/)
    expect(options.method).toBe('POST')
    expect(typeof options.body).toBe('string')
    const retry = fetchMock.mock.calls[2][0]
    expect(retry.searchParams.get('appid')).toBe('1005')
    expect(retry.searchParams.get('dfid')).toBe('new-registered-dfid')
  })

  it('keeps alternate playback available when device registration fails', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.pathname === '/risk/v3/r_register_dev') return new Response('invalid encrypted response')
      if (url.searchParams.get('appid') === '1005') return response({ error_code: 20028, msg: '本次请求需要验证' })
      return response({ status: 1, url: ['https://audio.example/alternate.mp3'] })
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await provider.handle('url', 'ABCDEF', 'KUGOU_API_MID=failed-registration-mid')).toMatchObject({
      url: 'https://audio.example/alternate.mp3',
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('falls back after an Auth rejection with status zero and no error code', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.pathname === '/v1/user_verify') return response({ status: 0, msg: '账号授权不可用' })
      if (url.searchParams.get('appid') === '3116') return response({ status: 3, url: [] })
      return response({ status: 1, url: ['https://audio.example/public.mp3'] })
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await provider.handle('url', 'ABCDEF', 'token=lite-token;userid=42;dfid=registered-dfid')).toMatchObject({
      url: 'https://audio.example/public.mp3',
    })
    expect(fetchMock.mock.calls.map(([url]) => url.pathname)).toEqual(['/v5/url', '/v1/user_verify', '/v5/url'])
  })

  it('rejects malformed upstream URL values and tries the alternate profile', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ status: 1, url: [' ', { url: 'https://audio.example/wrong.mp3' }] }))
      .mockResolvedValueOnce(response({ status: 1, backup_url: [' https://audio.example/valid.mp3 '] }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await provider.handle('url', 'ABCDEF')).toMatchObject({ url: 'https://audio.example/valid.mp3' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('registers the missing device when the Auth chain requests verification', async () => {
    vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from([0, 1, 2, 3, 4, 5]))
    const fetchMock = vi.fn(async (url) => {
      if (url.pathname === '/v5/url') return response({ status: 3, url: [] })
      if (url.pathname === '/risk/v3/r_register_dev') return registeredDeviceResponse('auth-registered-dfid')
      if (url.pathname === '/v1/user_verify') {
        return url.searchParams.get('dfid') === 'auth-registered-dfid'
          ? response({ status: 1, data: { auth: 'account-auth' } })
          : response({ error_code: 20028, msg: '本次请求需要验证' })
      }
      if (url.pathname === '/v1/authorization') return response({ status: 1, data: { auth: 'track-auth', open_time: 1700000000 } })
      return response({ status: 1, url: ['https://audio.example/auth-registered.mp3'] })
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await provider.handle('url', 'ABCDEF', 'token=account-token;userid=42;KUGOU_API_MID=auth-register-mid')).toMatchObject({
      url: 'https://audio.example/auth-registered.mp3',
    })
    expect(fetchMock.mock.calls.map(([url]) => url.pathname)).toEqual([
      '/v5/url', '/v1/user_verify', '/risk/v3/r_register_dev', '/v1/user_verify', '/v1/authorization', '/tracker/v5/url',
    ])
  })

  it('propagates unexpected playback errors after successful device registration', async () => {
    vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from([0, 1, 2, 3, 4, 5]))
    const fetchMock = vi.fn(async (url) => {
      if (url.pathname === '/risk/v3/r_register_dev') return registeredDeviceResponse('retry-error-dfid')
      return url.searchParams.get('dfid') === 'retry-error-dfid'
        ? response({ error_code: 401, msg: 'unexpected playback failure' })
        : response({ error_code: 20028, msg: '本次请求需要验证' })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(provider.handle('url', 'ABCDEF', 'KUGOU_API_MID=retry-error-mid')).rejects.toThrow('unexpected playback failure')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it.each(['http', 'timeout'])('keeps the original alternate profile available after an optional Auth %s failure', async (failure) => {
    const fetchMock = vi.fn(async (url) => {
      if (url.pathname === '/v1/user_verify') {
        if (failure === 'timeout') throw new DOMException('Auth request timed out', 'TimeoutError')
        return { ok: false, status: 401 }
      }
      return url.searchParams.get('appid') === '3116'
        ? response({ status: 3, url: [] })
        : response({ status: 1, url: ['https://audio.example/compatible.mp3'] })
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await provider.handle('url', 'ABCDEF', 'token=account-token;userid=42;dfid=registered-dfid')).toMatchObject({
      url: 'https://audio.example/compatible.mp3',
    })
    expect(fetchMock.mock.calls.map(([url]) => url.pathname)).toEqual(['/v5/url', '/v1/user_verify', '/v5/url'])
  })

  it('retains the legacy failure reason when Auth returns no additional diagnostics', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.pathname === '/v1/authorization') return response({ status: 1, data: { auth: 'track-auth', open_time: 1700000000 } })
      if (url.pathname === '/v5/url' && url.searchParams.get('appid') === '3116') {
        return response({ status: 3, url: [], fail_process: ['pkg'] })
      }
      return response({ status: 3, url: [] })
    })
    vi.stubGlobal('fetch', fetchMock)

    expect(await provider.handle('url', 'ABCDEF', 'token=account-token;userid=42;auth=account-auth;dfid=registered-dfid')).toMatchObject({
      url: '', reason: '版权受限',
    })
  })

  it('skips HTTP URLs with malformed hosts before trying the alternate profile', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(response({ status: 1, url: ['http://:80/song.mp3', 'https://?song=1'] }))
      .mockResolvedValueOnce(response({ status: 1, url: ['https://audio.example/valid-host.mp3'] })))

    expect(await provider.handle('url', 'ABCDEF')).toMatchObject({ url: 'https://audio.example/valid-host.mp3' })
  })
})
