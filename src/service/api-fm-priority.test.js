import { afterEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import store, { selectCookieForQuality } from '../admin/store.js'
import Providers from '../providers/index.js'
import { getTencentVerification } from '../providers/tencent/song.js'

describe('FM account selection', () => {
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

    it('uses the FM account for IDs and SVIP account for URLs even after a URL failure', async () => {
        const fmCookie = { id: 'fm', cookie: 'FM_COOKIE', isValid: true, fmPriority: true, userInfo: { canPlayVip: true } }
        const svipCookie = { id: 'svip', cookie: 'SVIP_COOKIE', isValid: true, userInfo: { canPlaySvip: true } }
        vi.spyOn(store, 'getActiveCookieForFm').mockImplementation(() => fmCookie.isValid ? fmCookie : svipCookie)
        vi.spyOn(store, 'getActiveCookieForQuality').mockImplementation((platform, quality, preferFm) =>
            selectCookieForQuality([fmCookie, svipCookie], quality, platform, preferFm))
        vi.spyOn(store, 'getFallbackCookieForQuality').mockReturnValue(null)
        const recordFailure = vi.spyOn(store, 'recordCookieUrlFailure').mockResolvedValue()
        vi.spyOn(store, 'isQualityRequiresSvip').mockReturnValue(true)
        const handle = vi.fn(async (type) => type === 'url' ? null : [{ url: 'song-id', pic: '', lrc: '' }])
        vi.spyOn(Providers.prototype, 'get').mockReturnValue({ support_type: ['url', 'fm'], handle })
        const context = (type, id) => ({
            req: { url: 'http://localhost/api', query: () => ({ server: 'netease', type, id, quality: type === 'url' ? 'sky' : undefined, fm: type === 'url' ? '1' : undefined }), header: () => '' },
            status: vi.fn(),
            json: vi.fn(value => value),
        })

        const [song] = await api(context('fm'))
        expect(song.url).toContain('id=song-id')
        expect(song.url).toContain('fm=1')
        expect(handle).toHaveBeenCalledWith('fm', '6907557348', 'FM_COOKIE', expect.any(Object))
        expect(await api(context('url', 'song-id'))).toEqual({ error: 'no url' })
        await api(context('fm'))

        expect(fmCookie.isValid).toBe(true)
        expect(svipCookie.isValid).toBe(true)
        expect(recordFailure).toHaveBeenCalledWith('svip', 'song-id', false)
        expect(handle).toHaveBeenCalledWith('url', 'song-id', 'SVIP_COOKIE', expect.any(Object))
        expect(handle).toHaveBeenLastCalledWith('fm', '6907557348', 'FM_COOKIE', expect.any(Object))
    })

    it('tries the FM account first, then another eligible account after no URL', async () => {
        const fmCookie = { id: 'fm', cookie: 'FM_COOKIE', isActive: true, isValid: true, fmPriority: true, userInfo: { canPlaySvip: true } }
        const backup = { id: 'backup', cookie: 'BACKUP_COOKIE', isActive: true, isValid: true, userInfo: { canPlaySvip: true } }
        vi.spyOn(store, 'getActiveCookieForQuality').mockReturnValue(fmCookie)
        vi.spyOn(store, 'getFallbackCookieForQuality').mockReturnValue(backup)
        const recordFailure = vi.spyOn(store, 'recordCookieUrlFailure').mockResolvedValue()
        const handle = vi.fn(async (type, id, cookie) => cookie === 'FM_COOKIE' ? null : { url: 'https://example.com/song.mp3' })
        vi.spyOn(Providers.prototype, 'get').mockReturnValue({ support_type: ['url'], handle })
        const ctx = {
            req: { query: () => ({ server: 'netease', type: 'url', id: 'song-id', quality: 'sky', fm: '1', redirect: '1' }), header: () => '' },
            json: vi.fn(value => value), status: vi.fn(), redirect: vi.fn(url => ({ url })),
        }

        expect((await api(ctx)).url).toBe('https://example.com/song.mp3')
        expect(handle.mock.calls.map(call => call[2])).toEqual(['FM_COOKIE', 'BACKUP_COOKIE'])
        expect(recordFailure).toHaveBeenCalledTimes(1)
        expect(recordFailure).toHaveBeenCalledWith('fm', 'song-id', false)
        expect(fmCookie.isValid).toBe(true)
    })

    it('returns the FM account URL without trying another account when it succeeds', async () => {
        const fmCookie = { id: 'fm', cookie: 'FM_COOKIE', isActive: true, isValid: true, userInfo: { canPlaySvip: true } }
        vi.spyOn(store, 'getActiveCookieForQuality').mockReturnValue(fmCookie)
        const fallback = vi.spyOn(store, 'getFallbackCookieForQuality').mockReturnValue(null)
        const recordFailure = vi.spyOn(store, 'recordCookieUrlFailure').mockResolvedValue()
        const handle = vi.fn().mockResolvedValue({ url: 'https://example.com/song.mp3' })
        vi.spyOn(Providers.prototype, 'get').mockReturnValue({ support_type: ['url'], handle })
        const ctx = {
            req: { query: () => ({ server: 'netease', type: 'url', quality: 'sky', fm: '1', redirect: '1' }), header: () => '' },
            json: vi.fn(value => value), status: vi.fn(), redirect: vi.fn(url => ({ url })),
        }

        expect((await api(ctx)).url).toBe('https://example.com/song.mp3')
        expect(handle).toHaveBeenCalledTimes(1)
        expect(fallback).not.toHaveBeenCalled()
        expect(recordFailure).not.toHaveBeenCalled()
    })

    it('remembers the failed Tencent song for verification after three URL failures', async () => {
        const account = { id: 'tencent-failure-test', platform: 'tencent', cookie: 'uin=123;qqmusic_key=test', isValid: true, isActive: true, urlErrorCount: 2 }
        store.cookies.set(account.id, account)
        vi.spyOn(store, 'getActiveCookie').mockReturnValue(account)
        vi.spyOn(store, 'getFallbackCookieForQuality').mockReturnValue(null)
        vi.spyOn(store, 'saveToFile').mockResolvedValue()
        vi.spyOn(Providers.prototype, 'get').mockReturnValue({ support_type: ['url'], handle: vi.fn().mockResolvedValue(null) })
        const ctx = { req: { query: () => ({ server: 'tencent', type: 'url', id: '0010BrWk2SucQr' }), header: () => '' }, status: vi.fn(), json: vi.fn(value => value) }
        try {
            expect(await api(ctx)).toEqual({ error: 'no url' })
            expect(account).toMatchObject({ urlErrorCount: 3, lastFailedSongmid: '0010BrWk2SucQr' })
        } finally {
            store.cookies.delete(account.id)
        }
    })

    it('persists a Tencent slider flag after the temporary challenge link expires', async () => {
        const account = { id: 'tencent-slider-api-test', platform: 'tencent', cookie: 'uin=456;qqmusic_key=test', isValid: true, isActive: true }
        store.cookies.set(account.id, account)
        vi.spyOn(store, 'getActiveCookie').mockReturnValue(account)
        vi.spyOn(store, 'getFallbackCookieForQuality').mockReturnValue(null)
        vi.spyOn(store, 'saveToFile').mockResolvedValue()
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce({ json: async () => ({ songinfo: { data: { track_info: { file: { media_mid: 'media', size_128mp3: 1 } } } } }) })
            .mockResolvedValueOnce({ json: async () => ({ req_0: { code: 104009, data: { validUrl: 'https://c.y.qq.com/r/fy6U?tokenValid=test', midurlinfo: [{ purl: '' }] } } }) }))
        const ctx = { req: { query: () => ({ server: 'tencent', type: 'url', id: '0010BrWk2SucQr' }), header: () => '' }, status: vi.fn(), json: vi.fn(value => value) }
        try {
            expect(await api(ctx)).toEqual({ error: 'no url' })
            expect(account).toMatchObject({ urlErrorCount: 1, tencentVerificationSongmid: '0010BrWk2SucQr' })
            vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60 * 1000)
            expect(getTencentVerification(account.cookie)).toBeNull()
            expect(account.tencentVerificationSongmid).toBe('0010BrWk2SucQr')
        } finally {
            store.cookies.delete(account.id)
        }
    })

    it('clears the stored slider prompt after Tencent playback succeeds', async () => {
        const account = { id: 'tencent-recovery-test', platform: 'tencent', cookie: 'uin=789;qqmusic_key=test', isValid: true, isActive: true, urlErrorCount: 3, lastFailedSongmid: 'old', tencentVerificationSongmid: 'old' }
        store.cookies.set(account.id, account)
        vi.spyOn(store, 'getActiveCookie').mockReturnValue(account)
        vi.spyOn(store, 'saveToFile').mockResolvedValue()
        vi.spyOn(Providers.prototype, 'get').mockReturnValue({ support_type: ['url'], handle: vi.fn().mockResolvedValue({ url: 'https://example.com/song.mp3' }) })
        const ctx = { req: { query: () => ({ server: 'tencent', type: 'url', id: 'new' }), header: () => '' }, status: vi.fn(), json: vi.fn(value => value) }
        try {
            expect((await api(ctx)).url).toBe('https://example.com/song.mp3')
            expect(account).toMatchObject({ urlErrorCount: 0, lastFailedSongmid: '', tencentVerificationSongmid: '' })
        } finally {
            store.cookies.delete(account.id)
        }
    })
    it.each([undefined, '1'])('tries every QQ backup and skips challenged accounts on the next request (fm=%s)', async (fm) => {
        const accounts = [3, 2, 1].map(number => ({
            id: `qq-backup-${number}`, platform: 'tencent', cookie: `uin=${number};qqmusic_key=test`,
            isActive: true, isValid: true, updatedAt: number,
            userInfo: { canPlaySvip: number > 1, canPlayVip: true },
        }))
        accounts.forEach(account => store.cookies.set(account.id, account))
        vi.spyOn(store, 'getCookies').mockReturnValue(accounts)
        vi.spyOn(store, 'getFmPriorityCookieId').mockReturnValue(accounts[0].id)
        vi.spyOn(store, 'saveToFile').mockResolvedValue()
        const handle = vi.fn(async (type, id, cookie) => cookie === accounts[2].cookie
            ? { url: 'https://example.com/song.flac', quality: 'SQ无损' }
            : { url: '', verificationRequired: true })
        vi.spyOn(Providers.prototype, 'get').mockReturnValue({ support_type: ['url'], handle })
        const ctx = {
            req: { query: () => ({ server: 'tencent', type: 'url', id: 'song', quality: 'master', fm }), header: () => '' },
            status: vi.fn(), json: vi.fn(value => value),
        }
        try {
            expect(await api(ctx)).toMatchObject({ url: 'https://example.com/song.flac', quality: 'SQ无损' })
            expect(handle.mock.calls.map(call => call[2])).toEqual(accounts.map(account => account.cookie))
            expect(accounts[0].tencentCooldownUntil).toBeGreaterThan(Date.now())
            expect(accounts[1].tencentCooldownUntil).toBeGreaterThan(Date.now())
            expect(accounts[0].urlErrorCount).toBe(1)
            expect(accounts[1].urlErrorCount).toBe(1)
            handle.mockClear()
            await api(ctx)
            expect(handle.mock.calls.map(call => call[2])).toEqual([accounts[2].cookie])
        } finally {
            accounts.forEach(account => store.cookies.delete(account.id))
        }
    })

    it('handles QQ exceptions and exhausts backups without looping or retrying the same Cookie', async () => {
        const accounts = [3, 2, 1].map(number => ({ id: `qq-exhaust-${number}`, platform: 'tencent', cookie: `uin=${number}`, isActive: true, isValid: true, updatedAt: number }))
        const duplicate = { ...accounts[0], id: 'qq-duplicate', updatedAt: 0 }
        accounts.forEach(account => store.cookies.set(account.id, account))
        vi.spyOn(store, 'getCookies').mockReturnValue([...accounts, duplicate])
        vi.spyOn(store, 'saveToFile').mockResolvedValue()
        const handle = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(null)
        vi.spyOn(Providers.prototype, 'get').mockReturnValue({ support_type: ['url'], handle })
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const ctx = { req: { query: () => ({ server: 'tencent', type: 'url', id: 'song' }), header: () => '' }, status: vi.fn(), json: vi.fn(value => value) }
        try {
            expect(await api(ctx)).toEqual({ error: 'no url' })
            expect(ctx.status).toHaveBeenCalledWith(403)
            expect(handle.mock.calls.map(call => call[2])).toEqual(accounts.map(account => account.cookie))
            expect(accounts.map(account => account.urlErrorCount)).toEqual([1, 1, 1])
            expect(accounts.every(account => !account.tencentCooldownUntil && account.isValid)).toBe(true)
        } finally {
            accounts.forEach(account => store.cookies.delete(account.id))
        }
    })

    it('does not replace an explicitly supplied QQ Cookie with server accounts', async () => {
        const fallback = vi.spyOn(store, 'getFallbackCookieForQuality')
        const failure = vi.spyOn(store, 'recordCookieUrlFailure')
        const handle = vi.fn().mockResolvedValue({ url: '', verificationRequired: true })
        vi.spyOn(Providers.prototype, 'get').mockReturnValue({ support_type: ['url'], handle })
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const ctx = { req: { query: () => ({ server: 'tencent', type: 'url', id: 'song' }), header: () => 'uin=explicit' }, status: vi.fn(), json: vi.fn(value => value) }
        expect(await api(ctx)).toEqual({ error: 'no url' })
        expect(handle).toHaveBeenCalledTimes(1)
        expect(fallback).not.toHaveBeenCalled()
        expect(failure).not.toHaveBeenCalled()
    })

    it('does not send anonymous requests when every stored QQ account is cooling down', async () => {
        const account = { id: 'qq-all-cooling', platform: 'tencent', isActive: true, isValid: true, tencentCooldownUntil: Date.now() + 3600000 }
        vi.spyOn(store, 'getCookies').mockReturnValue([account])
        const handle = vi.fn()
        vi.spyOn(Providers.prototype, 'get').mockReturnValue({ support_type: ['url'], handle })
        const ctx = { req: { query: () => ({ server: 'tencent', type: 'url', id: 'song' }), header: () => '' }, status: vi.fn(), json: vi.fn(value => value) }
        expect(await api(ctx)).toEqual({ error: 'no url' })
        expect(ctx.status).toHaveBeenCalledWith(403)
        expect(handle).not.toHaveBeenCalled()
    })
})
