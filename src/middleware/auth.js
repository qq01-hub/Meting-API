import store from '../admin/store.js'
import { verifyMetingAssertion } from './openmusicAssertion.js'

const extractBearerToken = (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) return ''
    return authHeader.substring(7).trim()
}

const applyApiTokenContext = (c, tokenData) => {
    c.set('username', tokenData.createdBy || 'api')
    c.set('isApiToken', true)
    c.set('tokenData', tokenData)
}

/** 程序化接口专用：仅接受 Authorization: Bearer <API Token> */
export const apiTokenMiddleware = async (c, next) => {
    c.header('Cache-Control', 'no-store, private')
    const reject = (code = 'OPENMUSIC_AUTH_REQUIRED') => c.json({ success: false, error: '需要 OpenMusic 服务端授权，请登录 OpenMusic 后重试', code }, code === 'OPENMUSIC_AUTH_BUSY' ? 503 : 401)
    const apiToken = extractBearerToken(c.req.header('Authorization'))
    const openmusicAuthEnabled = store.isOpenmusicAuthEnabled()
    if (!apiToken) return reject()
    if (openmusicAuthEnabled && (!c.req.header('X-OpenMusic-Assertion') || !c.req.header('X-OpenMusic-Signature'))) return reject()

    const result = store.validateApiToken(apiToken)
    if (!result.valid) return reject()

    let body = ''
    if (!['GET', 'HEAD'].includes(c.req.method) && c.req.raw.body) {
        let size = 0
        let tooLarge = false
        const signal = AbortSignal.timeout(10_000)
        const limited = c.req.raw.body.pipeThrough(new TransformStream({
            transform(chunk, controller) {
                size += chunk.byteLength
                if (size > 1024 * 1024) {
                    tooLarge = true
                    controller.error(new Error('request body too large'))
                    return
                }
                controller.enqueue(chunk)
            },
        }), { signal })
        c.req.raw = new Request(c.req.raw, { body: limited, duplex: 'half' })
        try {
            const bytes = await c.req.raw.arrayBuffer()
            body = new TextDecoder().decode(bytes)
            c.req.raw = new Request(c.req.raw, { body: bytes })
        } catch {
            const code = tooLarge ? 'REQUEST_BODY_TOO_LARGE' : signal.aborted ? 'REQUEST_BODY_TIMEOUT' : 'INVALID_REQUEST_BODY'
            return c.json({ success: false, error: '请求体无效或超过限制', code }, tooLarge ? 413 : signal.aborted ? 408 : 400)
        }
    }
    if (openmusicAuthEnabled) {
        const assertion = verifyMetingAssertion({ secret: apiToken, url: c.req.url, headers: c.req.raw.headers, method: c.req.method, body })
        if (!assertion.ok) return reject(assertion.code)
        c.set('openmusicAccountId', assertion.accountId)
        c.set('openmusicPurpose', assertion.purpose)
    }
    applyApiTokenContext(c, result.tokenData)
    try {
        return await next()
    } finally {
        c.header('Cache-Control', 'no-store, private')
    }
}

export const authMiddleware = async (c, next) => {
    const username = c.req.header('X-Auth-Username')
    const token = c.req.header('X-Auth-Token')
    const apiToken = extractBearerToken(c.req.header('Authorization'))

    if (apiToken) {
        return apiTokenMiddleware(c, next)
    }

    if (!username || !token) {
        return c.json({ success: false, error: '未提供认证信息' }, 401)
    }

    if (!store.validateToken(username, token)) {
        return c.json({ success: false, error: '认证信息无效或已过期' }, 401)
    }

    c.set('username', username)
    await next()
}

export const adminMiddleware = async (c, next) => {
    const isApiToken = c.get('isApiToken')
    
    if (isApiToken) {
        return await next()
    }
    
    const username = c.get('username')
    const user = store.users.get(username)
    
    if (!user || user.role !== 'admin') {
        return c.json({ success: false, error: '权限不足' }, 403)
    }
    
    await next()
}
