import store from '../admin/store.js'
import { authMiddleware, adminMiddleware, apiTokenMiddleware } from '../middleware/auth.js'
import { validateCookie } from './cookie-validator.js'
import cookieMonitor from './cookie-monitor.js'
import { createQishuiQr, checkQishuiQr, completeQishuiSecondVerify, getQishuiSecondVerifyAsset, requestQishuiSecondVerify, hasQishuiQrSession } from '../providers/qishui/qr.js'
import { createNeteaseQrSession, checkNeteaseQrSession } from '../providers/netease/qr_login.js'
import { createTencentQrSession, checkTencentQrSession } from '../providers/tencent/qr_login.js'
import { get_song_url, getTencentVerification } from '../providers/tencent/song.js'
import { startTencentVerification, getTencentVerificationFrame, sendTencentVerificationPointer, closeTencentVerification } from '../providers/tencent/verification.js'
import { createKugouQrSession, checkKugouQrSession } from '../providers/kugou/qr_login.js'
import Providers from '../providers/index.js'
import { get_url } from '../util.js'
import { wrapQishuiPlayPayload } from '../providers/qishui/audio.js'

/**
 * 汽水二次验证 iframe 专用鉴权。
 *
 * `security_host.html` 以 `sandbox="allow-scripts"` 内嵌，属于 opaque origin，
 * 无法携带 `X-Auth-Token` 等自定义请求头，因此这几条路由不能只依赖 authMiddleware。
 *
 * 这里采用能力凭证模型：二维码 token 由后台创建扫码会话时下发，仅在会话存活期间
 * 有效，且无法被外部猜测。已登录的管理员仍可通过常规请求头或 API Token 访问。
 */
const qishuiVerifyAuth = async (c, next) => {
    if (c.req.header('X-Auth-Token') || c.req.header('Authorization')) {
        return authMiddleware(c, next)
    }
    let body = {}
    try {
        body = await c.req.raw.clone().json()
    } catch {
        body = {}
    }
    const key = body.key || body.token || c.req.query('key') || c.req.query('token')
    if (key && hasQishuiQrSession(key)) {
        c.set('username', 'qishui-verify')
        return await next()
    }
    return authMiddleware(c, next)
}

const formatCookieForDisplay = (cookie) => {
    const { id, platform, createdAt, updatedAt, createdBy, isActive, isValid, validatedAt, userInfo, validationError, urlErrorCount, tencentSliderCount } = cookie
    const legacyContribution = String(cookie.note || '').startsWith('contribution:')
    const providerName = String(cookie.providerName || cookie.createdBy || '').trim()
    const note = legacyContribution ? `首页共享 · ${providerName || '匿名用户'}` : cookie.note
    let cookiePreview = cookie.cookie
    if (cookiePreview.length > 50) {
        cookiePreview = cookiePreview.substring(0, 50) + '...'
    }
    return {
        id, platform, cookiePreview, note, providerName, source: cookie.source || (legacyContribution ? 'contribution' : 'admin'),
        createdAt, updatedAt, createdBy, isActive, isValid, validatedAt, userInfo, validationError, urlErrorCount: urlErrorCount || 0,
        tencentSliderCount: Number(tencentSliderCount) || 0,
        fmPriority: store.getFmPriorityCookieId(platform) === id,
    }
}

export const adminRoutes = (app) => {
    app.post('/admin/login', async (c) => {
        const body = await c.req.json()
        const { username, password, code } = body
        
        if (!username || !password) {
            return c.json({ success: false, error: '用户名和密码不能为空' }, 400)
        }
        
        const result = await store.authenticateUser(username, password)
        
        if (result.success && result.require2FA) {
            if (!code) {
                return c.json({ 
                    success: true, 
                    require2FA: true, 
                    data: { username: result.data.username, role: result.data.role }
                })
            }
            const twoFAResult = await store.verify2FALogin(username, code)
        if (twoFAResult.success) {
            return c.json(twoFAResult)
        } else {
            return c.json(twoFAResult, 400)
        }
        }
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 401)
        }
    })

    app.post('/admin/logout', async (c) => {
        const username = c.req.header('X-Auth-Username')
        if (username) {
            await store.logoutUser(username)
        }
        return c.json({ success: true })
    })

    app.get('/admin/check', authMiddleware, async (c) => {
        const username = c.get('username')
        const user = store.users.get(username)
        return c.json({ 
            success: true, 
            data: { 
                username: user.username, 
                role: user.role 
            } 
        })
    })

    app.get('/admin/cookies', authMiddleware, async (c) => {
        const platform = c.req.query('platform')
        const cookies = store.getCookies(platform).map(formatCookieForDisplay)
        return c.json({ success: true, data: cookies })
    })

    app.get('/admin/cookies/tencent-verifications', authMiddleware, adminMiddleware, (c) => {
        const data = store.getCookies('tencent').flatMap(account => {
            const { id, cookie, userInfo, tencentVerificationSongmid, lastFailedSongmid, urlErrorCount, tencentSliderCount, tencentCooldownUntil } = account
            const pending = getTencentVerification(cookie)
            if (!pending && !tencentVerificationSongmid && (urlErrorCount || 0) < 3) return []
            const { note } = formatCookieForDisplay(account)
            return [{
                id, note: note || '', nickname: userInfo?.nickname || '',
                accountId: String(userInfo?.userId || cookie.match(/(?:^|;)\s*(?:uin|wxuin)=([^;]+)/)?.[1]?.trim() || ''),
                songmid: pending?.songmid || tencentVerificationSongmid || lastFailedSongmid || '',
                confirmed: Boolean(pending || tencentVerificationSongmid),
                urlErrorCount: Number(urlErrorCount) || 0, tencentSliderCount: Number(tencentSliderCount) || 0,
                tencentCooldownUntil: Number(tencentCooldownUntil) || 0,
            }]
        })
        c.header('Cache-Control', 'no-store')
        return c.json({ success: true, data })
    })

    app.post('/admin/cookies/:id/verification/start', authMiddleware, adminMiddleware, async (c) => {
        const id = c.req.param('id')
        const cookie = store.getCookie(id)
        if (cookie?.platform !== 'tencent') return c.json({ success: false, error: 'QQ 音乐 Cookie 不存在' }, 404)
        let pending = getTencentVerification(cookie.cookie)
        if (!pending) {
            if (!cookie.tencentVerificationSongmid && (cookie.urlErrorCount || 0) < 3) return c.json({ success: false, error: '当前账号无需验证' }, 400)
            const body = await c.req.json().catch(() => ({}))
            const songmid = cookie.tencentVerificationSongmid || cookie.lastFailedSongmid || String(body.songmid || '').trim()
            if (!/^[A-Za-z0-9]{1,64}$/.test(songmid)) return c.json({ success: false, error: '请输入需要播放的 QQ 音乐歌曲 ID' }, 400)
            try {
                const data = await get_song_url(songmid, cookie.cookie, { quality: 'standard' })
                if (data?.url) {
                    await store.recordCookieUrlSuccess(id)
                    return c.json({ success: false, error: '播放链接已恢复，无需滑块验证' }, 400)
                }
                pending = getTencentVerification(cookie.cookie)
                if (data?.verificationRequired) await store.recordCookieUrlFailure(id, songmid, true)
            } catch {}
            if (!pending) return c.json({ success: false, error: 'QQ 音乐未返回滑块验证，请检查歌曲权限或稍后重试' }, 400)
        }
        try {
            await startTencentVerification(id, cookie.cookie, pending.validUrl)
            return c.json({ success: true })
        } catch {
            return c.json({ success: false, error: '服务端验证浏览器启动失败，请确认已安装 Chrome/Chromium' }, 502)
        }
    })

    app.get('/admin/cookies/:id/verification/frame', authMiddleware, adminMiddleware, async (c) => {
        try {
            const image = await getTencentVerificationFrame(c.req.param('id'))
            return new Response(image, { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'no-store' } })
        } catch {
            return c.json({ success: false, error: '验证窗口已关闭' }, 404)
        }
    })

    app.post('/admin/cookies/:id/verification/pointer', authMiddleware, adminMiddleware, async (c) => {
        try {
            await sendTencentVerificationPointer(c.req.param('id'), await c.req.json())
            return c.json({ success: true })
        } catch {
            return c.json({ success: false, error: '验证窗口或鼠标事件无效' }, 400)
        }
    })

    app.post('/admin/cookies/:id/verification/close', authMiddleware, adminMiddleware, async (c) => {
        await closeTencentVerification(c.req.param('id'))
        return c.json({ success: true })
    })

    app.post('/admin/cookies/:id/retry-play', authMiddleware, adminMiddleware, async (c) => {
        const cookie = store.getCookie(c.req.param('id'))
        if (cookie?.platform !== 'tencent') return c.json({ success: false, error: 'QQ 音乐 Cookie 不存在' }, 404)
        const pending = getTencentVerification(cookie.cookie)
        const songmid = pending?.songmid || cookie.tencentVerificationSongmid || cookie.lastFailedSongmid
        if (!songmid) return c.json({ success: false, error: '请输入歌曲 ID 并先打开滑块验证' }, 400)
        try {
            const data = await get_song_url(songmid, cookie.cookie, { quality: 'standard' })
            if (data?.url) {
                await store.recordCookieUrlSuccess(cookie.id)
                await closeTencentVerification(cookie.id)
            } else await store.recordCookieUrlFailure(cookie.id, songmid, Boolean(data?.verificationRequired))
            return c.json({ success: Boolean(data?.url), error: data?.url ? undefined : '仍需验证，请确认滑块已完成后重试' })
        } catch {
            return c.json({ success: false, error: '播放重试失败，请稍后再试' }, 502)
        }
    })

    app.get('/admin/cookies/:id', authMiddleware, async (c) => {
        const id = c.req.param('id')
        const cookie = store.getCookie(id)
        
        if (!cookie) {
            return c.json({ success: false, error: 'Cookie不存在' }, 404)
        }
        
        return c.json({ success: true, data: formatCookieForDisplay(cookie) })
    })

    app.post('/admin/cookies', authMiddleware, async (c) => {
        const body = await c.req.json()
        const { platform, cookie, note, skipValidation } = body
        const username = c.get('username')
        
        const result = await store.addCookie(platform, cookie, note, username, skipValidation)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.put('/admin/cookies/:id', authMiddleware, async (c) => {
        const id = c.req.param('id')
        const body = await c.req.json()
        const username = c.get('username')
        const { skipValidation, ...updates } = body
        
        const result = await store.updateCookie(id, updates, username, skipValidation)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.delete('/admin/cookies/:id', authMiddleware, async (c) => {
        const id = c.req.param('id')
        const username = c.get('username')
        
        const result = await store.deleteCookie(id, username)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 404)
        }
    })

    app.post('/admin/cookies/:id/verify', authMiddleware, async (c) => {
        const id = c.req.param('id')
        const username = c.get('username')
        
        const result = await store.verifyCookie(id, username)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 404)
        }
    })

    app.post('/admin/cookies/:id/refresh', authMiddleware, async (c) => {
        const id = c.req.param('id')
        const cookie = store.getCookie(id)
        if (!cookie) {
            return c.json({ success: false, error: 'Cookie不存在' }, 404)
        }
        if (cookie.platform !== 'tencent') {
            return c.json({ success: false, error: '仅支持QQ音乐Cookie刷新' }, 400)
        }

        const refreshResult = await cookieMonitor.refreshTencentCookie(cookie)
        if (refreshResult.success) {
            return c.json({
                success: true,
                message: 'Cookie刷新成功',
                data: { id: cookie.id }
            })
        }
        return c.json({
            success: false,
            error: refreshResult.error || 'Cookie刷新失败'
        }, 400)
    })

    app.post('/admin/cookies/validate', authMiddleware, async (c) => {
        const body = await c.req.json()
        const { platform, cookie } = body
        
        if (!platform || !cookie) {
            return c.json({ success: false, error: '平台和Cookie数据不能为空' }, 400)
        }
        
        const result = await validateCookie(platform, cookie)
        return c.json({ success: true, data: result })
    })

    app.post('/admin/qr/create', authMiddleware, async (c) => {
        const body = await c.req.json()
        const platform = String(body.platform || '').trim().toLowerCase()
        try {
            const data = platform === 'qishui' ? await createQishuiQr()
                : platform === 'netease' ? await createNeteaseQrSession()
                    : platform === 'tencent' ? await createTencentQrSession()
                        : platform === 'kugou' ? await createKugouQrSession() : null
            if (!data) return c.json({ success: false, error: '不支持的扫码平台' }, 400)
            return c.json({ success: true, data })
        } catch (error) {
            console.error(`[QR] ${platform || 'unknown'} 创建失败:`, error?.message || error)
            return c.json({
                success: false,
                code: error?.code || 'QISHUI_QR_CREATE_FAILED',
                error: error?.message || '汽水音乐二维码生成失败',
            }, 502)
        }
    })

    // 汽水二次验证的静态资源（React、腾讯安全 SDK 等）。
    // 这些文件不含任何密钥，且 sandbox 内嵌的 iframe 加载子资源时既不带 key 也不带
    // Referer（sec-fetch-site: cross-site），无法参与凭证鉴权，因此保持公开可读，
    // 仅靠白名单限制文件名。真正的安全边界是下面带 key 校验的 bridge 路由。
    app.get('/admin/qr/qishui/security/:asset', async (c) => {
        try {
            const asset = getQishuiSecondVerifyAsset(c.req.param('asset'))
            return new Response(asset.body, { headers: { 'Content-Type': asset.contentType, 'Cache-Control': 'no-store' } })
        } catch (error) {
            return c.json({ success: false, error: error?.message || '汽水验证资源不存在' }, 404)
        }
    })

    const handleQishuiVerifyRequest = async (c) => {
        try {
            const body = await c.req.json()
            const data = await requestQishuiSecondVerify(body.key || body.token, body.request || {})
            return c.json({ success: true, data })
        } catch (error) {
            return c.json({ success: false, error: error?.message || '汽水验证请求失败' }, 502)
        }
    }

    app.post('/admin/qr/qishui/request', qishuiVerifyAuth, handleQishuiVerifyRequest)
    // security_host.html 以 bridgeRoot 为前缀拼接，会请求 /verify/request；
    // 与 openmusic 使用的 /qishui/request 保持两条路径共存。
    app.post('/admin/qr/qishui/verify/request', qishuiVerifyAuth, handleQishuiVerifyRequest)

    app.post('/admin/qr/qishui/verify/start', qishuiVerifyAuth, async (c) => {
        try {
            const body = await c.req.json()
            const result = await checkQishuiQr(body.key || body.token)
            if (result?.status !== 'second_verify') return c.json({ success: false, error: '当前会话不需要二次验证' }, 400)
            return c.json({ success: true, data: result.secondVerify })
        } catch (error) {
            return c.json({ success: false, error: error?.message || '汽水二次验证初始化失败' }, 502)
        }
    })

    app.post('/admin/qr/qishui/verify/complete', qishuiVerifyAuth, async (c) => {
        try {
            const body = await c.req.json()
            return c.json({ success: true, data: await completeQishuiSecondVerify(body.key || body.token) })
        } catch (error) {
            return c.json({ success: false, error: error?.message || '汽水二次验证完成失败' }, 502)
        }
    })

    app.post('/admin/qr/check', authMiddleware, async (c) => {
        const body = await c.req.json()
        const platform = String(body.platform || '').trim().toLowerCase()
        try {
            const data = platform === 'qishui' ? await checkQishuiQr(body.key || body.token)
                : platform === 'netease' ? await checkNeteaseQrSession(body.key || body.token)
                    : platform === 'tencent' ? await checkTencentQrSession({ qrsig: body.qrsig || body.key })
                        : platform === 'kugou' ? await checkKugouQrSession(body.key || body.token) : null
            if (!data) return c.json({ success: false, error: '不支持的扫码平台' }, 400)
            return c.json({ success: true, data })
        } catch (error) {
            return c.json({
                success: false,
                code: error?.code || 'QISHUI_QR_CHECK_FAILED',
                error: error?.message || '汽水音乐扫码状态查询失败',
            }, 502)
        }
    })

    app.get('/admin/openmusic', apiTokenMiddleware, async (c) => {
        const server = String(c.req.query('server') || '').trim().toLowerCase()
        const type = String(c.req.query('type') || '').trim().toLowerCase()
        const id = String(c.req.query('id') || '').trim()
        const cookie = String(c.req.header('X-OpenMusic-Cookie') || '').trim()
        const providers = new Providers()
        const provider = providers.get(server)
        if (!provider || !provider.support_type.includes(type)) {
            return c.json({ success: false, error: '房间私有接口参数无效' }, 400)
        }
        if (!cookie) return c.json({ success: false, error: '房间音源登录凭证为空' }, 400)
        try {
            let data = await provider.handle(type, id, cookie, { quality: c.req.query('quality') })
            if (server === 'qishui' && type === 'url' && data?.url && data?.auth) {
                data = wrapQishuiPlayPayload(c, data)
            }
            if (type === 'url' && data && typeof data === 'object') {
                return c.json({ ...data, loudness: data.loudness || null })
            }
            return c.json(data)
        } catch (error) {
            return c.json({ success: false, error: error?.message || '房间私有音源请求失败' }, 502)
        }
    })

    app.post('/admin/fm', apiTokenMiddleware, async (c) => {
        const body = await c.req.json()
        const platform = String(body.platform || 'netease').trim().toLowerCase()
        const cookie = String(body.cookie || '').trim()
        const mode = String(body.mode || '').trim()
        const excludeIds = new Set(Array.isArray(body.excludeIds) ? body.excludeIds.map((id) => String(id).trim()).filter(Boolean) : [])
        if (!['netease', 'tencent', 'qishui', 'kugou'].includes(platform) || !cookie) {
            return c.json({ success: false, error: '漫游平台或登录凭证无效' }, 400)
        }
        const provider = new Providers().get(platform)
        if (!provider?.support_type?.includes('fm')) {
            return c.json({ success: false, error: '该平台暂不支持漫游' }, 400)
        }
        try {
            for (let batch = 0; batch < (platform === 'qishui' ? 3 : 1); batch += 1) {
                const data = await provider.handle('fm', mode, cookie)
                if (platform !== 'qishui') return c.json({ success: true, data })
                if (!Array.isArray(data) || !data.length) continue
                const candidates = [...data]
                    .filter((song) => !excludeIds.has(String(song?.id || '').trim()))
                    .sort(() => Math.random() - 0.5)
                if (candidates.length) return c.json({ success: true, data: candidates })
            }
            return c.json({ success: false, error: '连续几批漫游歌曲都暂时没有可用候选' }, 403)
        } catch (error) {
            return c.json({ success: false, error: error?.message || '漫游歌曲获取失败' }, 502)
        }
    })

    app.post('/admin/contribute', authMiddleware, async (c) => {
        const body = await c.req.json()
        const platform = String(body.platform || '').trim().toLowerCase()
        const cookie = String(body.cookie || '').trim()
        const provider = String(body.providerName || body.provider || '').trim().slice(0, 40)
        if (!['netease', 'tencent', 'qishui', 'kugou'].includes(platform) || !cookie) {
            return c.json({ success: false, error: '平台或 Cookie 无效' }, 400)
        }
        const validation = await validateCookie(platform, cookie)
        if (!validation.valid) {
            return c.json({ success: false, error: validation.error || '账号验证失败' }, 400)
        }
        if (!validation.userInfo?.canPlayVip && !validation.userInfo?.isVip) {
            return c.json({ success: false, error: '这个账号暂时没有会员播放权益，暂时不能加入共享池；如果是在房间里绑定，仍然可以用来漫游哦～' }, 400)
        }
        const userId = String(validation.userInfo?.userId || '').trim()
        const displayName = provider || '匿名用户'
        const revokeToken = String(body.revokeToken || '').trim()
        if (!/^[A-Za-z0-9_-]{16,64}$/.test(revokeToken)) {
            return c.json({ success: false, error: '共享撤销令牌无效' }, 400)
        }
        const contributionKey = `${platform}:${userId || provider || 'anonymous'}`
        const legacyNote = `contribution:${contributionKey}`
        const note = `首页共享 · ${displayName}`
        const result = await store.addCookie(platform, cookie, note, displayName, false, {
            source: 'contribution',
            contributionKey,
            legacyNote,
            providerName: displayName,
            contributionToken: revokeToken,
        })
        if (!result.success) return c.json(result, 400)
        return c.json({
            success: true,
            data: formatCookieForDisplay(result.data),
            revokeToken,
            updated: true,
            message: '共享成功，谢谢你帮大家点亮更多好歌 ♪',
        })
    })

    app.post('/admin/contributions/revoke', authMiddleware, async (c) => {
        const body = await c.req.json()
        const token = String(body.revokeToken || '').trim()
        if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) {
            return c.json({ success: false, error: '撤销 ID 无效' }, 400)
        }
        const cookie = store.getCookies().find(item => (
            item.source === 'contribution'
            && item.contributionToken === token
        ))
        if (!cookie) return c.json({ success: false, error: '找不到对应的共享记录，可能已经取消' }, 404)
        const result = await store.deleteCookie(cookie.id, c.get('username'))
        return c.json(result, result.success ? 200 : 400)
    })

    app.get('/admin/contributions', authMiddleware, async (c) => {
        const limit = Math.max(1, Math.min(100, Number(c.req.query('limit')) || 20))
        const data = store.getCookies()
            .filter(cookie => (
                cookie.source === 'contribution'
                || cookie.contributionKey
                || String(cookie.note || '').startsWith('contribution:')
            ) && cookie.isValid !== false)
            .slice(0, limit)
            .map(cookie => ({
                providerName: cookie.providerName || cookie.createdBy || '匿名用户',
                platform: cookie.platform,
                tier: cookie.userInfo?.isSvip || cookie.userInfo?.canPlaySvip ? 'svip' : 'vip',
                source: 'homepage',
                updatedAt: cookie.updatedAt || cookie.createdAt || Date.now(),
            }))
        return c.json({ success: true, data })
    })

    app.get('/admin/users', authMiddleware, adminMiddleware, async (c) => {
        const users = store.getUsers()
        return c.json({ success: true, data: users })
    })

    app.post('/admin/users', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const { username: newUsername, password, role } = body
        const operator = c.get('username')
        
        if (!newUsername || !password) {
            return c.json({ success: false, error: '用户名和密码不能为空' }, 400)
        }
        
        const result = await store.addUser({ username: newUsername, password, role }, operator)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.put('/admin/users/:username', authMiddleware, adminMiddleware, async (c) => {
        const targetUsername = c.req.param('username')
        const body = await c.req.json()
        const operator = c.get('username')
        
        const result = await store.updateUser(targetUsername, body, operator)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.put('/admin/profile', authMiddleware, async (c) => {
        const currentUsername = c.get('username')
        const body = await c.req.json()
        
        const result = await store.updateUser(currentUsername, body, currentUsername)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.delete('/admin/users/:username', authMiddleware, adminMiddleware, async (c) => {
        const targetUsername = c.req.param('username')
        const operator = c.get('username')
        
        const result = await store.deleteUser(targetUsername, operator)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.get('/admin/logs', authMiddleware, async (c) => {
        const limit = parseInt(c.req.query('limit') || '100')
        const offset = parseInt(c.req.query('offset') || '0')
        const logs = store.getLogs(limit, offset)
        return c.json({ success: true, data: logs })
    })

    app.put('/admin/password', authMiddleware, async (c) => {
        const body = await c.req.json()
        const { oldPassword, newPassword } = body
        const username = c.get('username')
        
        if (!oldPassword || !newPassword) {
            return c.json({ success: false, error: '旧密码和新密码不能为空' }, 400)
        }
        
        const user = store.users.get(username)
        if (user.password !== store.hashPassword(oldPassword)) {
            return c.json({ success: false, error: '旧密码错误' }, 400)
        }
        
        const result = await store.updateUser(username, { password: newPassword }, username)
        return c.json(result)
    })

    app.get('/admin/config', authMiddleware, adminMiddleware, async (c) => {
        const config = store.getConfig()
        return c.json({ success: true, data: config })
    })

    app.put('/admin/config/qishui-signer', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const result = await store.setQishuiSignerUrl(body?.url, c.get('username'))
        return c.json(result, result.success ? 200 : 400)
    })
    app.put('/admin/config/loudness-service', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const result = await store.setLoudnessServiceUrl(body?.url, c.get('username'))
        return c.json(result, result.success ? 200 : 400)
    })
    app.put('/admin/config/fm-priority', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const result = await store.setFmPriorityCookie(body?.platform, body?.cookieId, c.get('username'))
        return c.json(result, result.success ? 200 : 400)
    })
    app.put('/admin/config/admin-path', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const { adminPath } = body
        const operator = c.get('username')
        
        const result = await store.setAdminPath(adminPath, operator)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.get('/admin/webhook', authMiddleware, adminMiddleware, async (c) => {
        const config = store.getWebhookConfig()
        return c.json({ success: true, data: config })
    })

    app.put('/admin/webhook', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const operator = c.get('username')
        
        const result = await store.setWebhookConfig(body, operator)
        
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.post('/admin/webhook/test', authMiddleware, adminMiddleware, async (c) => {
        const result = await cookieMonitor.testWebhook()
        
        if (result.sent) {
            return c.json({ success: true, message: 'Webhook测试消息已发送' })
        } else {
            return c.json({ success: false, error: result.error || '发送失败' }, 400)
        }
    })

    app.get('/admin/monitor', authMiddleware, adminMiddleware, async (c) => {
        const config = store.getMonitorConfig()
        return c.json({ success: true, data: config })
    })

    app.put('/admin/monitor', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const operator = c.get('username')
        
        const result = await store.setMonitorConfig(body, operator)
        
        if (result.success) {
            if (body.enabled !== undefined || body.interval !== undefined) {
                cookieMonitor.restart()
            }
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.get('/admin/monitor/status', authMiddleware, adminMiddleware, async (c) => {
        const status = cookieMonitor.getStatus()
        return c.json({ success: true, data: status })
    })

    app.post('/admin/monitor/check', authMiddleware, adminMiddleware, async (c) => {
        const result = await cookieMonitor.checkNow()
        
        if (result.success) {
            return c.json({ success: true, message: '检查已完成' })
        } else {
            return c.json(result, 400)
        }
    })

    app.get('/admin/monitor/logs', authMiddleware, adminMiddleware, async (c) => {
        const limit = parseInt(c.req.query('limit') || '100')
        const offset = parseInt(c.req.query('offset') || '0')
        const logs = store.getMonitorLogs(limit, offset)
        return c.json({ success: true, data: logs })
    })

    app.get('/admin/2fa/status', authMiddleware, async (c) => {
        const username = c.get('username')
        const status = store.get2FAStatus(username)
        return c.json({ success: true, data: status })
    })

    app.post('/admin/2fa/setup', authMiddleware, async (c) => {
        const username = c.get('username')
        const result = store.setup2FA(username)
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.post('/admin/2fa/enable', authMiddleware, async (c) => {
        const body = await c.req.json()
        const { code } = body
        const username = c.get('username')

        if (!code) {
            return c.json({ success: false, error: '验证码不能为空' }, 400)
        }

        const result = await store.enable2FA(username, code)
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.post('/admin/2fa/disable', authMiddleware, async (c) => {
        const body = await c.req.json()
        const { password } = body
        const username = c.get('username')

        if (!password) {
            return c.json({ success: false, error: '密码不能为空' }, 400)
        }

        const result = await store.disable2FA(username, password)
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 400)
        }
    })

    app.get('/admin/tokens', authMiddleware, adminMiddleware, async (c) => {
        const tokens = store.getApiTokens()
        return c.json({ success: true, data: tokens })
    })

    app.post('/admin/tokens', authMiddleware, adminMiddleware, async (c) => {
        const body = await c.req.json()
        const { name, permissions } = body
        const operator = c.get('username')

        if (!name) {
            return c.json({ success: false, error: 'Token名称不能为空' }, 400)
        }

        const result = await store.createApiToken(name, permissions || [], operator)
        return c.json(result)
    })

    app.get('/admin/tokens/:id', authMiddleware, adminMiddleware, async (c) => {
        const id = c.req.param('id')
        const token = store.getApiToken(id)
        if (!token) {
            return c.json({ success: false, error: 'Token不存在' }, 404)
        }
        const { token: _, ...safeToken } = token
        return c.json({ success: true, data: safeToken })
    })

    app.put('/admin/tokens/:id', authMiddleware, adminMiddleware, async (c) => {
        const id = c.req.param('id')
        const body = await c.req.json()
        const operator = c.get('username')

        const result = await store.updateApiToken(id, body, operator)
        if (result.success) {
            const { token: _, ...safeToken } = result.data
            return c.json({ success: true, data: safeToken })
        } else {
            return c.json(result, 400)
        }
    })

    app.delete('/admin/tokens/:id', authMiddleware, adminMiddleware, async (c) => {
        const id = c.req.param('id')
        const operator = c.get('username')

        const result = await store.deleteApiToken(id, operator)
        if (result.success) {
            return c.json(result)
        } else {
            return c.json(result, 404)
        }
    })
}

export default adminRoutes
