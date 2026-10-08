import { afterEach, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { adminRoutes } from './api.js'
import store from './store.js'
import { get_song_url } from '../providers/tencent/song.js'
import { startTencentVerification, getTencentVerificationFrame, sendTencentVerificationPointer } from '../providers/tencent/verification.js'

vi.mock('../providers/tencent/verification.js', () => ({
    startTencentVerification: vi.fn(),
    getTencentVerificationFrame: vi.fn(async () => new Uint8Array([1, 2, 3])),
    sendTencentVerificationPointer: vi.fn(),
    closeTencentVerification: vi.fn(),
}))

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

it('opens a Cookie-bound verification browser only for an authenticated admin', async () => {
    const cookie = 'uin=789;qqmusic_key=PRIVATE_COOKIE'
    const mockFetch = vi.fn()
        .mockResolvedValueOnce({ json: async () => ({ songinfo: { data: { track_info: { file: { media_mid: 'media', size_128mp3: 1 } } } } }) })
        .mockResolvedValueOnce({ json: async () => ({ req_0: { code: 104009, data: { validUrl: 'https://c.y.qq.com/r/fy6U?tokenValid=PRIVATE_TOKEN', midurlinfo: [{ purl: '' }] } } }) })
    vi.stubGlobal('fetch', mockFetch)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await get_song_url('0010BrWk2SucQr', cookie, { quality: 'standard' })
    vi.spyOn(store, 'getCookies').mockReturnValue([{ id: 'account-1', platform: 'tencent', cookie, note: '主力 QQ', userInfo: { nickname: '音乐爱好者', userId: '789' }, urlErrorCount: 2, tencentSliderCount: 4, tencentCooldownUntil: 4600000 }, { id: 'account-2', platform: 'tencent', cookie: 'other' }])
    vi.spyOn(store, 'validateToken').mockReturnValue(true)
    vi.spyOn(store.users, 'get').mockReturnValue({ role: 'admin' })
    const app = new Hono()
    adminRoutes(app)

    expect((await app.request('/admin/cookies/tencent-verifications')).status).toBe(401)
    const response = await app.request('/admin/cookies/tencent-verifications', { headers: { 'X-Auth-Username': 'admin', 'X-Auth-Token': 'test' } })
    expect(response.status).toBe(200)
    const responseBody = await response.json()
    expect(responseBody.data).toEqual([{ id: 'account-1', note: '主力 QQ', nickname: '音乐爱好者', accountId: '789', songmid: '0010BrWk2SucQr', confirmed: true, urlErrorCount: 2, tencentSliderCount: 4, tencentCooldownUntil: 4600000 }])
    expect(JSON.stringify(responseBody)).not.toContain('PRIVATE_COOKIE')
    expect(JSON.stringify(responseBody)).not.toContain('PRIVATE_TOKEN')
    const list = await (await app.request('/admin/cookies', { headers: { 'X-Auth-Username': 'admin', 'X-Auth-Token': 'test' } })).json()
    expect(list.data.map(account => account.tencentSliderCount)).toEqual([4, 0])

    vi.spyOn(store, 'getCookie').mockReturnValue({ id: 'account-1', platform: 'tencent', cookie })
    const headers = { 'X-Auth-Username': 'admin', 'X-Auth-Token': 'test' }
    expect((await app.request('/admin/cookies/account-1/verification/frame')).status).toBe(401)
    expect((await app.request('/admin/cookies/account-1/verification/start', { method: 'POST', headers })).status).toBe(200)
    expect(startTencentVerification).toHaveBeenCalledWith('account-1', cookie, 'https://c.y.qq.com/r/fy6U?tokenValid=PRIVATE_TOKEN')
    expect((await app.request('/admin/cookies/account-1/verification/frame', { headers })).headers.get('content-type')).toBe('image/webp')
    expect(getTencentVerificationFrame).toHaveBeenCalledWith('account-1')
    expect((await app.request('/admin/cookies/account-1/verification/pointer', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'down', x: 20, y: 30 }) })).status).toBe(200)
    expect(sendTencentVerificationPointer).toHaveBeenCalledWith('account-1', { type: 'down', x: 20, y: 30 })
    mockFetch
        .mockResolvedValueOnce({ json: async () => ({ songinfo: { data: { track_info: { file: { media_mid: 'media', size_128mp3: 1 } } } } }) })
        .mockResolvedValueOnce({ json: async () => ({ req_0: { data: { sip: ['https://stream.qq.com/'], midurlinfo: [{ purl: 'song.mp3', result: 0 }] } } }) })
        .mockResolvedValueOnce({ status: 206 })
    expect(await (await app.request('/admin/cookies/account-1/retry-play', { method: 'POST', headers })).json()).toEqual({ success: true })
    expect((await (await app.request('/admin/cookies/tencent-verifications', { headers })).json()).data).toEqual([])
})

it('restores a three-failure prompt after the short-lived challenge expires and refreshes it on demand', async () => {
    const cookie = 'uin=998;qqmusic_key=PRIVATE_COOKIE'
    const account = { id: 'old-account', platform: 'tencent', cookie, urlErrorCount: 3 }
    vi.spyOn(store, 'getCookies').mockReturnValue([account])
    vi.spyOn(store, 'getCookie').mockReturnValue(account)
    vi.spyOn(store, 'validateToken').mockReturnValue(true)
    vi.spyOn(store.users, 'get').mockReturnValue({ role: 'admin' })
    const app = new Hono()
    adminRoutes(app)
    const headers = { 'X-Auth-Username': 'admin', 'X-Auth-Token': 'test' }
    expect((await (await app.request('/admin/cookies/tencent-verifications', { headers })).json()).data).toEqual([{ id: 'old-account', note: '', nickname: '', accountId: '998', songmid: '', confirmed: false, urlErrorCount: 3, tencentSliderCount: 0, tencentCooldownUntil: 0 }])

    vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ json: async () => ({ songinfo: { data: { track_info: { file: { media_mid: 'media', size_128mp3: 1 } } } } }) })
        .mockResolvedValueOnce({ json: async () => ({ req_0: { code: 104009, data: { validUrl: 'https://c.y.qq.com/r/fy6U?tokenValid=FRESH', midurlinfo: [{ purl: '' }] } } }) }))
    const response = await app.request('/admin/cookies/old-account/verification/start', {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ songmid: '0010BrWk2SucQr' }),
    })
    expect(response.status).toBe(200)
    expect(startTencentVerification).toHaveBeenCalledWith('old-account', cookie, 'https://c.y.qq.com/r/fy6U?tokenValid=FRESH')
})
