import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import crypto from 'node:crypto'
import store from '../admin/store.js'
import { apiTokenMiddleware, authMiddleware } from './auth.js'

const secret = 'test-openmusic-config-token'
const originalConfig = store.config
const app = new Hono()
const echo = async c => c.json({ username: c.get('username'), purpose: c.get('openmusicPurpose'), body: c.req.method === 'POST' ? await c.req.json() : null })
app.all('/music', apiTokenMiddleware, echo)
app.get('/management', authMiddleware, echo)
const bearer = { Authorization: `Bearer ${secret}` }
const signedHeaders = (body = '', method = 'GET') => {
    const assertion = Buffer.from(JSON.stringify({ v: 1, sub: 'openmusic:system', purpose: 'system', ts: Math.floor(Date.now() / 1000), nonce: crypto.randomBytes(18).toString('base64url') })).toString('base64url')
    const payload = [assertion, method, '/music', crypto.createHash('sha256').update(body).digest('hex')].join('\n')
    return { ...bearer, 'X-OpenMusic-Assertion': assertion, 'X-OpenMusic-Signature': crypto.createHmac('sha256', secret).update(payload).digest('base64url') }
}

beforeEach(() => {
    store.config = {}
    store.apiTokens.set('openmusic-config-test', { token: secret, createdBy: 'test-admin' })
})
afterEach(() => {
    store.config = originalConfig
    store.apiTokens.delete('openmusic-config-test')
    vi.restoreAllMocks()
})

describe('OpenMusic 授权开关', () => {
    it('旧配置默认开启并拒绝仅 Bearer 请求', async () => {
        expect(store.getConfig().openmusicAuthEnabled).toBe(true)
        expect((await app.request('/music', { headers: bearer })).status).toBe(401)
    })
    it('关闭后仅凭有效 API Token 即可调用且不校验无效 OpenMusic 参数', async () => {
        store.config.openmusicAuthEnabled = false
        for (const headers of [bearer, { ...bearer, 'X-OpenMusic-Assertion': 'invalid', 'X-OpenMusic-Signature': 'invalid' }]) {
            const response = await app.request('/music', { headers })
            expect(response.status).toBe(200)
            expect(response.headers.get('Cache-Control')).toBe('no-store, private')
            expect(await response.json()).toEqual({ username: 'test-admin', body: null })
        }
    })
    it('关闭后保留 JSON 请求体供业务接口读取', async () => {
        store.config.openmusicAuthEnabled = false
        const response = await app.request('/music', { method: 'POST', headers: { ...bearer, 'Content-Type': 'application/json' }, body: '{"value":42}' })
        expect(response.status).toBe(200)
        expect((await response.json()).body).toEqual({ value: 42 })
    })
    it('关闭后管理 Bearer 入口同样跳过 OpenMusic 校验', async () => {
        store.config.openmusicAuthEnabled = false
        expect((await app.request('/management', { headers: bearer })).status).toBe(200)
    })
    it('关闭后仍拒绝缺少或无效的 API Token', async () => {
        store.config.openmusicAuthEnabled = false
        for (const headers of [{}, { Authorization: 'Bearer invalid' }]) {
            expect((await app.request('/music', { headers })).status).toBe(401)
        }
    })
    it('重新开启立即恢复签名及防重放校验', async () => {
        store.config.openmusicAuthEnabled = false
        expect((await app.request('/music', { headers: bearer })).status).toBe(200)
        store.config.openmusicAuthEnabled = true
        expect((await app.request('/music', { headers: bearer })).status).toBe(401)
        const headers = signedHeaders()
        expect((await app.request('/music', { headers })).status).toBe(200)
        const replay = await app.request('/music', { headers })
        expect(replay.status).toBe(401)
        expect((await replay.json()).code).toBe('OPENMUSIC_REPLAY')
    })
    it('开启后验证 POST 签名且保留请求体', async () => {
        const body = '{"value":42}'
        const response = await app.request('/music', { method: 'POST', headers: { ...signedHeaders(body, 'POST'), 'Content-Type': 'application/json' }, body })
        expect(response.status).toBe(200)
        expect((await response.json()).body).toEqual({ value: 42 })
    })
})
