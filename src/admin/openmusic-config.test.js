import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import store from './store.js'
import { adminRoutes } from './api.js'

const originalConfig = store.config
const headers = { 'X-Auth-Username': 'config-test-admin', 'X-Auth-Token': 'test-session', 'Content-Type': 'application/json' }
let app
beforeEach(() => {
    store.config = {}
    vi.spyOn(store, 'saveToFile').mockResolvedValue(undefined)
    vi.spyOn(store, 'addLog').mockResolvedValue(undefined)
    vi.spyOn(store, 'validateToken').mockImplementation((username, token) => username === 'config-test-admin' && token === 'test-session')
    store.users.set('config-test-admin', { role: 'admin' })
    app = new Hono()
    adminRoutes(app)
})
afterEach(() => {
    store.config = originalConfig
    store.users.delete('config-test-admin')
    vi.restoreAllMocks()
})
const update = enabled => app.request('/admin/config/openmusic-auth', { method: 'PUT', headers, body: JSON.stringify({ enabled }) })

describe('管理 OpenMusic 授权配置', () => {
    it('旧配置默认开启且可保存关闭和重新开启', async () => {
        expect((await (await app.request('/admin/config', { headers })).json()).data.openmusicAuthEnabled).toBe(true)
        for (const enabled of [false, true]) {
            const response = await update(enabled)
            expect(response.status).toBe(200)
            expect((await response.json()).data.openmusicAuthEnabled).toBe(enabled)
            expect((await (await app.request('/admin/config', { headers })).json()).data.openmusicAuthEnabled).toBe(enabled)
        }
        expect(store.saveToFile).toHaveBeenCalledTimes(2)
        expect(store.addLog).toHaveBeenCalledWith('config_update', expect.any(String), 'config-test-admin')
    })
    it('拒绝非布尔值且不更改配置或写盘', async () => {
        for (const enabled of [undefined, null, 'false', 0, {}]) {
            expect((await update(enabled)).status).toBe(400)
            expect(store.getConfig().openmusicAuthEnabled).toBe(true)
        }
        expect(store.saveToFile).not.toHaveBeenCalled()
    })
    it('拒绝匿名请求与普通用户修改配置', async () => {
        expect((await app.request('/admin/config/openmusic-auth', { method: 'PUT', body: '{"enabled":false}' })).status).toBe(401)
        store.users.set('config-test-admin', { role: 'user' })
        expect((await update(false)).status).toBe(403)
        expect(store.saveToFile).not.toHaveBeenCalled()
    })
})
