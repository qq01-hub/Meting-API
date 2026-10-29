import api from './src/service/api.js'
import { handler } from './src/template.js'
import { renderHomepage } from './src/homepage.js'
import { adminPageHandler } from './src/admin/page.js'
import adminRoutes from './src/admin/api.js'
import store from './src/admin/store.js'
import cookieMonitor from './src/admin/cookie-monitor.js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import config from './src/config.js'
import { get_runtime, get_url } from './src/util.js'
import { isQishuiRequestAbort, qishuiAudioResponse } from './src/providers/qishui/audio.js'
import { openmusicMiddleware } from './src/middleware/openmusic.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { version: APP_VERSION } = require('./package.json')

const app = new Hono()

app.use('*', cors())
app.use('*', async (context, next) => {
    await next()
    const path = context.req.path
    const logPath = ['/', '/api', '/test', '/audio/qishui'].includes(path) ? path : path.startsWith('/admin/') ? path : '[other]'
    if (context.res.status >= 400) {
        let response = ''
        try { response = (await context.res.clone().text()).slice(0, 2000) } catch {}
        try {
            const apiLogContext = context.get('apiLogContext') || {}
            const internalError = context.get('httpError') || ''
            await store.addApiLog({
                method: context.req.method,
                path,
                status: context.res.status,
                level: 'error',
                platform: apiLogContext.platform || '',
                cookieId: apiLogContext.cookieId || '',
                error: internalError || response,
            })
        } catch (error) {
            console.error('[HTTP] 接口日志写入失败', error?.message || error)
        }
    }
    console.info('[HTTP]', context.req.method, logPath, context.res.status)
})

app.onError((error, c) => {
    const invalid = error instanceof SyntaxError || error?.status === 400
    const status = invalid ? 400 : 500
    c.set('httpError', error?.message || (invalid ? '请求格式无效' : '服务请求失败'))
    console.error('[HTTP]', c.req.method, invalid ? 'INVALID_REQUEST' : 'INTERNAL_ERROR')
    return c.json({ success: false, error: invalid ? '请求格式无效' : '服务请求失败', code: invalid ? 'INVALID_REQUEST' : 'INTERNAL_ERROR' }, status)
})

adminRoutes(app)

const getAdminPath = () => {
    const storedPath = store.getAdminPath()
    return storedPath || config.ADMIN_PATH
}

app.use('*', async (c, next) => {
    const adminPath = getAdminPath()
    const path = c.req.path
    
    if (path === '/' + adminPath || path.startsWith('/' + adminPath + '/')) {
        return adminPageHandler(c)
    }
    
    await next()
})

app.get('/api', openmusicMiddleware, api)
app.get('/audio/qishui', openmusicMiddleware, async (c) => {
    try {
        return await qishuiAudioResponse(c)
    } catch (error) {
        if (isQishuiRequestAbort(error, c.req.raw?.signal)) {
            // 浏览器切歌或重新请求 Range 时会主动关闭旧连接，不应伪装成播放失败。
            return new Response(null, { status: 499 })
        }
        console.error('[QishuiAudio]', 'UPSTREAM_AUDIO_FAILED')
        return c.json({ error: '汽水音频请求失败', code: 'UPSTREAM_AUDIO_FAILED' }, 502)
    }
})
app.get('/test', openmusicMiddleware, handler)
app.get('/', (c) => {
    return c.html(renderHomepage({
        baseUrl: get_url(c),
        runtime: get_runtime(),
        port: config.PORT,
        overseas: Boolean(config.OVERSEAS),
        version: APP_VERSION,
    }))
})

cookieMonitor.start()

export default app
