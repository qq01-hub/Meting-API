/**
 * QQ 音乐 Cookie 续期
 *
 * 对齐 QQMusicApi LoginApi.refresh_credential：
 * module=music.login.LoginServer method=Login loginMode=2
 * 需同时携带 musickey + refresh_key + refresh_token 等字段。
 *
 * 旧接口 QQConnectLogin.LoginServer/QQLogin 仅传 musickey 或 refresh_token，
 * 容易 104400 / 刷新失败。
 */
import { postLoginServer } from './qr_login.js'

const parseCookieString = (cookieString) => {
    if (!cookieString) return {}
    const cookies = {}
    cookieString.split(';').forEach((item) => {
        const idx = item.indexOf('=')
        if (idx <= 0) return
        const key = item.slice(0, idx).trim()
        const value = item.slice(idx + 1).trim()
        if (key && value) cookies[key] = value
    })
    return cookies
}

const normalizeMusicId = (uin) => {
    if (!uin) return 0
    const digits = String(uin).replace(/\D/g, '')
    return parseInt(digits, 10) || 0
}

const resolveUin = (cookie) => cookie.uin || cookie.wxuin || cookie.qqmusic_uin || ''

const inferLoginType = (cookie, musickey = '') => {
    // 扫码 Cookie 里 login_type 常被写死为 2，真实类型在 tmeLoginType（App 扫码多为 6）
    const fromTme = Number(cookie.tmeLoginType || 0)
    if (fromTme > 0) return fromTme

    const key = musickey || cookie.qqmusic_key || cookie.qm_keyst || ''
    // QQMusicApi Credential：W_X 开头为微信登录 (login_type=1)，其余默认 QQ (2)
    if (typeof key === 'string' && key.startsWith('W_X')) return 1

    const fromLoginType = Number(cookie.login_type || 0)
    // 仅信任非 2 的 login_type，避免扫码 Cookie 的假 2 覆盖 App 登录态
    if (fromLoginType > 0 && fromLoginType !== 2) return fromLoginType
    return 2
}

const buildRefreshParam = (cookie, musicid) => {
    const musickey = cookie.qqmusic_key || cookie.qm_keyst || ''
    const refreshKey = cookie.refresh_key || ''
    const refreshToken = cookie.psrf_qqrefresh_token || cookie.refresh_token || ''
    const accessToken = cookie.psrf_qqaccess_token || cookie.access_token || ''
    const openid = cookie.psrf_qqopenid || cookie.openid || ''
    const unionid = cookie.unionid || ''
    const expiredAt = Number(cookie.psrf_access_token_expiresAt || cookie.expired_at || 0) || 0
    const strMusicId = cookie.str_musicid || String(musicid)
    const loginType = inferLoginType(cookie, musickey)

    // 与 QQMusicApi refresh_credential 三分支一致
    if (loginType === 1) {
        return {
            loginType,
            param: {
                openid,
                refresh_token: refreshToken,
                str_musicid: strMusicId,
                musickey,
                unionid,
                refresh_key: refreshKey,
                loginMode: 2,
            },
        }
    }

    if (loginType === 2) {
        return {
            loginType,
            param: {
                openid,
                access_token: accessToken,
                refresh_token: refreshToken,
                expired_in: expiredAt,
                musicid,
                musickey,
                refresh_key: refreshKey,
                loginMode: 2,
            },
        }
    }

    return {
        loginType,
        param: {
            openid,
            access_token: accessToken,
            refresh_token: refreshToken,
            expired_in: expiredAt,
            str_musicid: strMusicId,
            musicid,
            musickey,
            unionid,
            refresh_key: refreshKey,
            loginMode: 2,
        },
    }
}

export const buildRefreshResult = (loginData, fallbackUin, deviceCookie = '') => {
    const musicIdRaw = loginData.str_musicid || loginData.musicid || normalizeMusicId(fallbackUin) || fallbackUin
    const musicId = String(musicIdRaw).replace(/^o/, '')
    const uin = musicId ? `o${musicId}` : String(fallbackUin || '')
    const updates = {
        uin,
        wxuin: uin,
        qqmusic_key: loginData.musickey,
        qm_keyst: loginData.musickey,
        p_lskey: loginData.musickey,
    }

    if (deviceCookie) updates.psrf_qqdevice = deviceCookie

    if (loginData.refresh_key) updates.refresh_key = loginData.refresh_key
    if (loginData.access_token) updates.psrf_qqaccess_token = loginData.access_token
    if (loginData.openid) updates.psrf_qqopenid = loginData.openid
    if (loginData.refresh_token) updates.psrf_qqrefresh_token = loginData.refresh_token
    if (loginData.expired_at) updates.psrf_access_token_expiresAt = String(loginData.expired_at)
    if (loginData.musickeyCreateTime) updates.psrf_musickey_createtime = String(loginData.musickeyCreateTime)
    if (loginData.encryptUin) updates.euin = loginData.encryptUin
    if (loginData.loginType !== undefined && loginData.loginType !== null) {
        updates.tmeLoginType = String(loginData.loginType)
    }

    const newCookie = Object.entries(updates)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')

    return {
        success: true,
        cookie: newCookie,
        musickey: loginData.musickey,
        refreshToken: loginData.refresh_token || null,
        refreshKey: loginData.refresh_key || null,
        accessToken: loginData.access_token || null,
        expire: loginData.expired_at || null,
    }
}

const callRefreshLogin = async (cookie) => {
    const uin = resolveUin(cookie)
    const musicid = normalizeMusicId(uin)
    const musickey = cookie.qqmusic_key || cookie.qm_keyst || ''

    if (!musicid) {
        return { success: false, error: 'uin 无效，无法解析 musicid' }
    }
    if (!musickey) {
        return { success: false, error: 'Cookie 缺少 qqmusic_key / qm_keyst' }
    }

    const refreshKey = cookie.refresh_key || ''
    const refreshToken = cookie.psrf_qqrefresh_token || cookie.refresh_token || ''
    if (!refreshKey && !refreshToken) {
        return {
            success: false,
            error: 'Cookie 缺少 refresh_key / psrf_qqrefresh_token，无法续期，请重新扫码登录',
        }
    }

    const { loginType, param } = buildRefreshParam(cookie, musicid)

    // 与扫码登录同一套 Android CGI（含 QIMEI），comm.tmeLoginType 对齐 QQMusicApi
    const { code, data: loginData } = await postLoginServer({
        method: 'Login',
        param,
        comm: {
            tmeLoginType: loginType,
            qq: String(musicid),
            authst: musickey,
            uin: musicid,
        },
        allowErrorCodes: true,
        deviceCookie: cookie.psrf_qqdevice || '',
    })

    console.log(
        `[QQMusic Refresh] loginType=${loginType}, code=${code}, hasKey=${!!loginData.musickey}, hasRefreshKey=${!!refreshKey}, hasRefreshToken=${!!refreshToken}`,
    )

    if (loginData.musickey) {
        return buildRefreshResult(loginData, uin, cookie.psrf_qqdevice || '')
    }

    const messages = {
        1000: '登录态无效或已过期，请重新扫码',
        104400: '登录态无效或已过期，请重新扫码',
        104401: '登录态无效或已过期，请重新扫码',
        20279: '登录设备数量超限',
        104604: '操作过于频繁，请稍后重试',
    }
    const errorMsg =
        messages[code] ||
        loginData.errMsg ||
        loginData.errmsg ||
        (code !== undefined ? `错误码 ${code}` : '未知错误')

    return { success: false, error: `Cookie刷新失败: ${errorMsg}`, code }
}

/** 用完整 Cookie 续期（推荐） */
export const refreshTencentCookie = async (cookieString) => {
    try {
        const cookie = parseCookieString(cookieString)
        return await callRefreshLogin(cookie)
    } catch (e) {
        console.error('[QQMusic Refresh] Error:', e)
        return {
            success: false,
            error: `刷新出错: ${e.message}`,
        }
    }
}

/**
 * 兼容旧调用：仅 refresh_token + uin。
 * 若缺少 musickey/refresh_key，成功率会明显低于完整 Cookie 续期。
 */
export const refreshTencentCookieByRefreshToken = async (refreshToken, uin, extra = {}) => {
    try {
        if (!refreshToken || !uin) {
            return { success: false, error: '缺少 refresh_token 或 uin' }
        }
        const cookie = {
            uin: String(uin),
            psrf_qqrefresh_token: refreshToken,
            qqmusic_key: extra.musickey || extra.qqmusic_key || '',
            qm_keyst: extra.musickey || extra.qm_keyst || '',
            refresh_key: extra.refresh_key || '',
            psrf_qqaccess_token: extra.access_token || '',
            psrf_qqopenid: extra.openid || '',
            tmeLoginType: extra.tmeLoginType || '',
            ...extra,
        }
        // 无 musickey 时无法对齐官方刷新参数
        if (!cookie.qqmusic_key && !cookie.qm_keyst) {
            return {
                success: false,
                error: '缺少 musickey，请改用完整 Cookie 刷新',
            }
        }
        const result = await callRefreshLogin(cookie)
        if (result.success && !result.refreshToken) {
            result.refreshToken = refreshToken
        }
        return result
    } catch (e) {
        console.error('[QQMusic Refresh] Error:', e)
        return {
            success: false,
            error: `刷新出错: ${e.message}`,
        }
    }
}

export default {
    refreshTencentCookie,
    refreshTencentCookieByRefreshToken,
}
