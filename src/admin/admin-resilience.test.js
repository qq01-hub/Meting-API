import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { adminRoutes } from './api.js'
import store from './store.js'
import Providers from '../providers/index.js'
import cookieMonitor, { isFmPriorityCookie } from './cookie-monitor.js'
import { validateCookie } from './cookie-validator.js'

vi.mock('./cookie-validator.js', () => ({ validateCookie: vi.fn() }))

const authHeaders = {
    Authorization: 'Bearer test-token',
    'Content-Type': 'application/json',
}

const createApp = () => {
    store.config = { openmusicAuthEnabled: false }
    vi.spyOn(store, 'validateApiToken').mockReturnValue({
        valid: true,
        tokenData: { createdBy: 'test-admin' },
    })
    const app = new Hono()
    app.use('*', async (context, next) => {
        await next()
        if (context.res.status >= 400) {
            await store.addApiLog({
                method: context.req.method,
                path: context.req.path,
                status: context.res.status,
                error: await context.res.clone().text(),
            })
        }
    })
    adminRoutes(app)
    return app
}

describe('后台接口稳定性', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('FM 上游异常时返回可消费的空列表，不返回 502', async () => {
        const app = createApp()
        vi.spyOn(Providers.prototype, 'get').mockReturnValue({
            support_type: ['fm'],
            handle: vi.fn().mockRejectedValue(new Error('上游超时')),
        })
        vi.spyOn(store, 'addApiLog').mockResolvedValue()

        const response = await app.request('/admin/fm', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ platform: 'netease', cookie: 'MUSIC_U=test-cookie' }),
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({ success: true, data: [] })
    })

    it('接口错误响应会写入接口日志', async () => {
        const app = createApp()
        vi.spyOn(store, 'addApiLog').mockResolvedValue()

        const response = await app.request('/admin/fm', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ platform: 'netease' }),
        })

        expect(response.status).toBe(400)
        expect(store.addApiLog).toHaveBeenCalledWith(expect.objectContaining({
            method: 'POST',
            path: '/admin/fm',
            status: 400,
            error: expect.stringContaining('漫游平台或登录凭证无效'),
        }))
    })

    it('FM 优先账号不触发 Cookie 失效和会员提醒', async () => {
        const fmCookie = {
            id: 'fm-priority',
            platform: 'netease',
            note: 'FM账号',
            isActive: true,
            isValid: true,
            fmPriority: true,
            userInfo: { canPlayVip: true },
        }
        vi.spyOn(store, 'getFmPriorityCookieId').mockReturnValue(fmCookie.id)
        vi.spyOn(store, 'updateCookie').mockResolvedValue()
        vi.spyOn(store, 'addMonitorLog').mockResolvedValue()
        vi.spyOn(cookieMonitor, 'sendWebhookNotification').mockResolvedValue()
        vi.mocked(validateCookie).mockResolvedValue({
            valid: false,
            error: 'Cookie 已过期',
            userInfo: { canPlayVip: false },
        })

        const invalid = vi.spyOn(cookieMonitor, 'handleCookieInvalid')
        const vipLost = vi.spyOn(cookieMonitor, 'handleVipLost')
        const vipUnavailable = vi.spyOn(cookieMonitor, 'handleVipUnavailable')
        await cookieMonitor.checkCookie(fmCookie)

        expect(isFmPriorityCookie(fmCookie, store.getFmPriorityCookieId.bind(store))).toBe(true)
        expect(invalid).not.toHaveBeenCalled()
        expect(vipLost).not.toHaveBeenCalled()
        expect(vipUnavailable).not.toHaveBeenCalled()
    })
})
