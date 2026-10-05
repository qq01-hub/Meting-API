import { request } from '../providers/netease/util.js'
import { changeUrlQuery } from '../providers/tencent/util.js'
import { getVipLoginInfo } from '../providers/tencent/qr_login.js'

const detectSvip = (...sources) => sources.some((source) => {
    if (!source || typeof source !== 'object') return false
    return source.isSvip === true
        || source.is_svip === true
        || source.isSuperVip === true
        || source.is_super_vip === true
        || source.svip === true
        || source.superVip === true
        || source.super_vip === true
        || Number(source.svipType || source.svip_type || source.superVipType || source.super_vip_type) > 0
        || ['svip', 'supervip'].includes(String(source.vipStage || source.vip_stage || source.vipLevelName || source.vip_level_name || '').toLowerCase().replace(/[ _-]/g, ''))
})
import { getQishuiProfile } from '../providers/qishui/index.js'
import { isKugouMembershipRequestParamError, mapKugouMembership, parseKugouCookie, requestKugou } from '../providers/kugou/index.js'

const parseCookieString = (cookieString) => {
    if (!cookieString) return {}
    const cookies = {}
    cookieString.split(';').forEach(item => {
        const [key, value] = item.trim().split('=')
        if (key && value) {
            cookies[key] = value
        }
    })
    return cookies
}

const checkNeteaseVipAbility = async (cookieString) => {
    try {
        const testSongId = '254059'
        const data = {
            ids: '[' + testSongId + ']',
            level: 'standard',
            encodeType: 'flac',
        }
        
        const res = await request(
            'POST',
            'https://interface.music.163.com/eapi/song/enhance/player/url/v1',
            data,
            {
                crypto: 'eapi',
                url: '/api/song/enhance/player/url/v1',
                cookie: cookieString
            }
        )
        
        if (res.data && res.data[0]) {
            const songData = res.data[0]
            const url = songData.url
            
            if (!url) {
                return false
            }
            
            if (url.includes('try') || url.includes('trial')) {
                return false
            }
            
            if (songData.freeTrialInfo) {
                return false
            }
            
            if (songData.freePartInfo) {
                return false
            }
            
            if (songData.level === 'trial' || songData.level === 'try') {
                return false
            }
            
            return true
        }
        return false
    } catch (e) {
        return false
    }
}

const getTencentMembership = async (cookie) => {
    try {
        const { code, data } = await getVipLoginInfo({
            uin: cookie.uin || '',
            musickey: cookie.qqmusic_key || cookie.qm_keyst || '',
            loginType: cookie.tmeLoginType || cookie.login_type || 2,
            deviceCookie: cookie.psrf_qqdevice || '',
        })
        if (code !== 0) return null
        return mapTencentMembership(data)
    } catch {
        return null
    }
}

const getTencentExpiry = (source) => {
    if (!source || typeof source !== 'object') return 0
    const expiryNames = new Set([
        'svipendtime', 'svipexpiretime', 'svipend', 'svipexpire',
        'hugevipendtime', 'hugevipexpiretime', 'hugevipend', 'hugevipexpire',
    ])
    const visit = (node, depth = 0) => {
        if (!node || typeof node !== 'object' || depth > 4) return 0
        for (const [key, value] of Object.entries(node)) {
            const normalizedKey = String(key).toLowerCase().replace(/[^a-z0-9]/g, '')
            if (expiryNames.has(normalizedKey)) {
                let expiry = Number(value || 0)
                if (!Number.isFinite(expiry) && typeof value === 'string') {
                    const parsedTime = Date.parse(value.replace(' ', 'T') + (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? '' : '+08:00'))
                    expiry = Number.isFinite(parsedTime) ? parsedTime / 1000 : 0
                }
                if (Number.isFinite(expiry) && expiry > 0) return expiry > 100_000_000_000 ? expiry / 1000 : expiry
            }
            const nested = visit(value, depth + 1)
            if (nested) return nested
        }
        return 0
    }
    return visit(source)
}

export const mapTencentMembership = (data = {}, now = Math.floor(Date.now() / 1000)) => {
    const identity = data.identity || data.Identity || {}
    const svipExpiry = getTencentExpiry(data) || getTencentExpiry(identity)
    const svipActive = !svipExpiry || svipExpiry > now
    const isSvip = svipActive && (Number(data.svip || data.SVip) > 0
        || Number(identity.HugeVip || identity.hugeVip || identity.huge_vip) > 0)
    const isVip = isSvip || Number(identity.vip || identity.Vip) > 0
    return { isVip, isSvip, vipType: isSvip ? 2 : isVip ? 1 : 0 }
}

export const validateNeteaseCookie = async (cookieString) => {
    try {
        const cookie = parseCookieString(cookieString)
        
        if (!cookie.MUSIC_U && !cookie.MUSIC_A) {
            return {
                valid: false,
                error: 'Cookie缺少必要的认证信息 (MUSIC_U 或 MUSIC_A)',
                userInfo: null
            }
        }

        const data = {}
        const res = await request(
            'POST',
            'https://music.163.com/weapi/w/nuser/account/get',
            data,
            {
                crypto: 'weapi',
                cookie: cookieString
            }
        )

        if (res.code === 200 && res.account) {
            const isVip = (res.profile?.vipType || 0) > 0
            const isSvip = detectSvip(res.profile, res.account)
            let canPlayVip = isVip
            
            if (!isVip) {
                canPlayVip = await checkNeteaseVipAbility(cookieString)
            }
            
            return {
                valid: true,
                error: null,
                userInfo: {
                    userId: res.account?.id || res.profile?.userId,
                    nickname: res.profile?.nickname || '未知用户',
                    avatarUrl: res.profile?.avatarUrl || '',
                    vipType: res.profile?.vipType || 0,
                    isVip: isVip,
                    isSvip,
                    canPlaySvip: isSvip,
                    canPlayVip: canPlayVip
                }
            }
        } else if (res.code === 301) {
            return {
                valid: false,
                error: 'Cookie已过期，请重新获取',
                userInfo: null
            }
        } else if (res.code === 200 && !res.account) {
            const canPlayVip = await checkNeteaseVipAbility(cookieString)
            
            return {
                valid: true,
                error: null,
                userInfo: {
                    userId: null,
                    nickname: '游客用户',
                    avatarUrl: '',
                    vipType: 0,
                    isVip: false,
                    canPlayVip: canPlayVip
                }
            }
        } else {
            return {
                valid: false,
                error: `验证失败: ${res.message || res.msg || '未知错误'}`,
                userInfo: null
            }
        }
    } catch (e) {
        return {
            valid: false,
            error: `验证出错: ${e.message}`,
            userInfo: null
        }
    }
}

export const validateTencentCookie = async (cookieString) => {
    try {
        const cookie = parseCookieString(cookieString)
        
        if (!cookie.uin && !cookie.qqmusic_key) {
            return {
                valid: false,
                error: 'Cookie缺少必要的认证信息 (uin 或 qqmusic_key)',
                userInfo: null
            }
        }

        const uin = cookie.uin || ''
        const qqmusic_key = cookie.qqmusic_key || ''

        const membership = await getTencentMembership(cookie)
        const data = {
            data: JSON.stringify({
                comm: {
                    ct: 19,
                    cv: 0,
                    uin: uin,
                    format: 'json',
                    authst: qqmusic_key
                },
                req_0: {
                    module: 'music.UserInfoSvr',
                    method: 'GetUserInfo',
                    param: {}
                }
            })
        }

        const url = changeUrlQuery(data, 'https://u.y.qq.com/cgi-bin/musicu.fcg')
        const res = await fetch(url, {
            headers: {
                Referer: 'https://y.qq.com/',
                'User-Agent': 'Mozilla/5.0',
                Cookie: cookieString,
            },
        })
        const result = await res.json()

        if (result.req_0 && result.req_0.code === 0) {
            const userInfo = result.req_0.data
            // 会员接口不可用时不沿用用户信息里的旧 SVIP 字段，避免已过期账号继续拿到 SVIP 权益。
            const isSvip = membership ? membership.isSvip : false
            const isVip = membership ? membership.isVip : (userInfo?.vip || 0) > 0
            
            return {
                valid: true,
                error: null,
                userInfo: {
                    userId: userInfo?.uin || uin,
                    nickname: userInfo?.nick || 'QQ用户',
                    avatarUrl: userInfo?.headpic || '',
                    vipType: membership?.vipType || userInfo?.vip || 0,
                    isVip: isVip,
                    isSvip,
                    canPlaySvip: isSvip,
                    canPlayVip: isVip
                }
            }
        } else if (membership) {
            return {
                valid: true,
                error: null,
                userInfo: {
                    userId: uin,
                    nickname: 'QQ用户',
                    avatarUrl: '',
                    vipType: membership.vipType,
                    isVip: membership.isVip,
                    isSvip: membership.isSvip,
                    canPlaySvip: membership.isSvip,
                    canPlayVip: membership.isVip,
                },
            }
        } else if (result.req_0 && result.req_0.code === 1000) {
            return {
                valid: false,
                error: 'Cookie已过期，请重新获取',
                userInfo: null
            }
        } else {
            return {
                valid: true,
                error: null,
                userInfo: {
                    userId: uin,
                    nickname: 'QQ用户',
                    avatarUrl: '',
                    vipType: 0,
                    isVip: false,
                    isSvip: false,
                    canPlaySvip: false,
                    canPlayVip: false
                }
            }
        }
    } catch (e) {
        return {
            valid: false,
            error: `验证出错: ${e.message}`,
            userInfo: null
        }
    }
}

export const validateQishuiCookie = async (cookieString) => getQishuiProfile(cookieString)
export const validateKugouCookie = async (cookieString) => {
    const cookie = parseKugouCookie(cookieString)
    if (!cookie.token || !cookie.userid) {
        return {
            valid: false,
            error: '酷狗音乐 Cookie 需要同时包含 token 和 userid，才能在线验证会员权益',
            userInfo: null,
        }
    }

    try {
        const verification = await requestKugou('/v1/user_verify', {
            base: 'https://trackercdngz.kugou.com',
            params: { module_id: 51 },
            cookie: { ...cookie, __raw: cookieString },
        })
        if (Number(verification?.status) !== 1 || !verification?.data?.auth) {
            return { valid: false, error: '酷狗登录校验未通过，请重新扫码登录', userInfo: null }
        }
    } catch (error) {
        return {
            valid: false,
            error: Number(error.code) === 35005
                ? '酷狗 token 已失效，请重新扫码登录后再验证'
                : `酷狗登录校验失败: ${error.message}`,
            userInfo: null,
        }
    }

    try {
        const result = await requestKugou('/v1/get_union_vip', {
            base: 'https://kugouvip.kugou.com',
            params: { busi_type: 'concept' },
            cookie: { ...cookie, __raw: cookieString },
        })
        if (Number(result?.status) === 0 || Number(result?.error_code) !== 0 && result?.error_code !== undefined) {
            return { valid: false, error: result?.error || result?.msg || '酷狗 Cookie 已过期或无效', userInfo: null }
        }

        const membership = mapKugouMembership(result, cookie)
        const profile = result?.data?.user || result?.data?.userinfo || result?.data || result || {}
        return {
            valid: true,
            error: null,
            userInfo: {
                userId: profile.userid || profile.user_id || cookie.userid,
                nickname: profile.nickname || profile.nick_name || '酷狗用户',
                avatarUrl: profile.avatar || profile.avatar_url || profile.headimg || '',
                ...membership,
            },
        }
    } catch (error) {
        if (isKugouMembershipRequestParamError(error)) {
            return {
                valid: true,
                error: null,
                userInfo: {
                    userId: cookie.userid,
                    nickname: '酷狗用户',
                    avatarUrl: '',
                    vipType: 0,
                    isVip: false,
                    isSvip: false,
                    canPlayVip: false,
                    canPlaySvip: false,
                    membershipPending: true,
                },
            }
        }
        return { valid: false, error: `验证出错: ${error.message}`, userInfo: null }
    }
}

export const validateCookie = async (platform, cookieString) => {
    if (platform === 'netease') {
        return await validateNeteaseCookie(cookieString)
    } else if (platform === 'tencent') {
        return await validateTencentCookie(cookieString)
    } else if (platform === 'qishui') {
        return await validateQishuiCookie(cookieString)
    } else if (platform === 'kugou') {
        return await validateKugouCookie(cookieString)
    } else {
        return {
            valid: false,
            error: '不支持的平台类型',
            userInfo: null
        }
    }
}

export default {
    validateCookie,
    validateNeteaseCookie,
    validateTencentCookie,
    validateQishuiCookie,
    validateKugouCookie,
}
