import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import store from '../admin/store.js'
import Providers from '../providers/index.js'

describe('QQ FM 来源日志', () => {
    let logs, handle, selected, backup
    const context = (server = 'tencent', explicit = '') => ({
        req: {
            method: 'GET', path: '/api', url: 'http://localhost/api',
            query: () => ({ server, type: 'fm' }), header: () => explicit,
        },
        status: vi.fn(), json: vi.fn(value => value),
    })

    beforeEach(() => {
        selected = {
            id: 'preferred', platform: 'tencent', isActive: true, isValid: true,
            cookie: 'uin=o123456789; qqmusic_key=PRIVATE_KEY; psrf_qqrefresh_token=PRIVATE_REFRESH; tmeLoginType=2',
            userInfo: { userId: '123456789' },
        }
        backup = { ...selected, id: 'backup', cookie: 'uin=o987654321; qqmusic_key=BACKUP_KEY' }
        logs = vi.spyOn(store, 'addApiLog').mockResolvedValue()
        vi.spyOn(console, 'info').mockImplementation(() => {})
        vi.spyOn(store, 'getFmPriorityCookieId').mockReturnValue(selected.id)
        vi.spyOn(store, 'getCookie').mockImplementation(id => id === selected.id ? selected : backup)
        vi.spyOn(store, 'getActiveCookieForFm').mockReturnValue(selected)
        vi.spyOn(store, 'getFallbackCookieForFm').mockReturnValue(null)
        vi.spyOn(store, 'recordCookieRequestSuccess').mockResolvedValue()
        vi.spyOn(store, 'recordCookieFmSuccess').mockResolvedValue()
        vi.spyOn(store, 'recordCookieFmFailure').mockResolvedValue()
        handle = vi.fn().mockResolvedValue([{ id: 'song-id', url: 'song-id', pic: '', lrc: '' }])
        vi.spyOn(Providers.prototype, 'get').mockReturnValue({ support_type: ['fm'], handle })
    })
    afterEach(() => vi.restoreAllMocks())

    const traces = () => logs.mock.calls.map(([log]) => log).filter(log => log.code === 'FM_TENCENT_TRACE')

    it('记录成功来源、歌曲 ID 和脱敏身份，不记录密钥或完整账号', async () => {
        await api(context())
        expect(traces()).toEqual(expect.arrayContaining([
            expect.objectContaining({
                event: 'success', preferredCookieId: 'preferred', cookieId: 'preferred',
                switched: false, songCount: 1, songIds: ['song-id'],
                identity: expect.objectContaining({ uin: '***6789', userId: '***6789' }),
            }),
        ]))
        const output = JSON.stringify([logs.mock.calls, vi.mocked(console.info).mock.calls])
        for (const secret of ['PRIVATE_KEY', 'PRIVATE_REFRESH', '123456789']) {
            expect(output).not.toContain(secret)
        }
    })

    it.each([
        ['preferred_invalid', { isValid: false }],
        ['preferred_inactive', { isActive: false }],
        ['preferred_slider_cooldown', { tencentCooldownUntil: Date.now() + 3600000 }],
        ['preferred_fm_cooldown', { fmCooldownUntil: Date.now() + 30000 }],
    ])('记录指定账号在选择前被跳过的原因 %s', async (reason, state) => {
        Object.assign(selected, state)
        vi.mocked(store.getActiveCookieForFm).mockReturnValue(backup)
        await api(context())
        expect(traces()).toEqual(expect.arrayContaining([
            expect.objectContaining({
                event: 'selection', preferredCookieId: 'preferred', cookieId: 'backup',
                switched: true, reason,
            }),
        ]))
    })

    it.each(['error', 'empty'])('回退成功也保留原账号的 %s 记录并关联同一次请求', async (failure) => {
        if (failure === 'error') handle.mockRejectedValueOnce(new Error('upstream failed'))
        else handle.mockResolvedValueOnce([])
        vi.mocked(store.getFallbackCookieForFm).mockReturnValue(backup)
        await api(context())
        expect(traces()).toEqual(expect.arrayContaining([
            expect.objectContaining({ event: failure, cookieId: 'preferred' }),
            expect.objectContaining({ event: 'success', cookieId: 'backup', switched: true, attempt: 2 }),
        ]))
        expect(new Set(traces().map(log => log.traceId)).size).toBe(1)
        expect(logs).toHaveBeenCalledWith(expect.objectContaining({
            cookieId: 'preferred', code: failure === 'empty' ? 'FM_EMPTY_RESULT' : 'UPSTREAM_REQUEST_FAILED',
        }))
    })

    it('记录显式 Cookie 来源但不记录凭据', async () => {
        await api(context('tencent', selected.cookie))
        expect(traces()).toEqual(expect.arrayContaining([
            expect.objectContaining({ event: 'success', source: 'explicit', cookieId: '', switched: false }),
        ]))
    })

    it('未设置优先账号时也能识别请求内换号', async () => {
        vi.mocked(store.getFmPriorityCookieId).mockReturnValue(null)
        handle.mockResolvedValueOnce([])
        vi.mocked(store.getFallbackCookieForFm).mockReturnValue(backup)
        await api(context())
        expect(traces()).toEqual(expect.arrayContaining([
            expect.objectContaining({
                event: 'success', initialCookieId: 'preferred', cookieId: 'backup', switched: true,
            }),
        ]))
    })

    it('标记 Cookie 与已验证身份不一致，身份仍保持脱敏', async () => {
        selected.userInfo.userId = '222223333'
        await api(context())
        expect(traces()).toEqual(expect.arrayContaining([
            expect.objectContaining({
                event: 'success',
                identity: expect.objectContaining({ consistent: false, uin: '***6789', userId: '***3333' }),
            }),
        ]))
    })

    it('日志持久化失败不会触发换号或影响 FM 返回', async () => {
        logs.mockRejectedValue(new Error('disk full'))
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const songs = await api(context())
        expect(songs).toHaveLength(1)
        expect(handle).toHaveBeenCalledTimes(1)
        expect(store.getFallbackCookieForFm).not.toHaveBeenCalled()
    })

    it('没有可用账号时记录指定账号不可用的原因', async () => {
        selected.fmCooldownUntil = Date.now() + 30000
        vi.mocked(store.getActiveCookieForFm).mockReturnValue(null)
        const ctx = context()
        await api(ctx)
        expect(ctx.status).toHaveBeenCalledWith(503)
        expect(traces()).toEqual(expect.arrayContaining([
            expect.objectContaining({ event: 'selection', reason: 'preferred_fm_cooldown', cookieId: '' }),
        ]))
    })

    it('其他平台不增加 FM 来源日志', async () => {
        await api(context('netease'))
        expect(traces()).toEqual([])
        expect(console.info).not.toHaveBeenCalled()
    })
})
