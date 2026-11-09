import store from '../admin/store.js'

const parseIdentity = (cookie = '', userInfo = {}) => {
    const fields = {}
    for (const item of cookie.split(';')) {
        const index = item.indexOf('=')
        if (index > 0) fields[item.slice(0, index).trim()] = item.slice(index + 1).trim()
    }
    const normalize = value => String(value || '').replace(/^o/, '')
    const mask = value => {
        const id = normalize(value)
        return id ? `***${id.length > 4 && /^\d+$/.test(id) ? id.slice(-4) : ''}` : ''
    }
    const ids = [fields.uin, fields.wxuin, fields.qqmusic_uin, fields.str_musicid, userInfo?.userId]
        .map(normalize).filter(Boolean)
    return {
        uin: mask(fields.uin),
        wxuin: mask(fields.wxuin),
        qqmusicUin: mask(fields.qqmusic_uin),
        musicId: mask(fields.str_musicid),
        userId: mask(userInfo?.userId),
        consistent: ids.length > 1 ? new Set(ids).size === 1 : null,
        loginType: /^\d{1,2}$/.test(fields.tmeLoginType || '') ? fields.tmeLoginType : '',
        hasAuthKey: Boolean(fields.qqmusic_key || fields.qm_keyst),
    }
}

const accountState = account => account ? {
    isActive: account.isActive,
    isValid: account.isValid,
    validatedAt: account.validatedAt || 0,
    updatedAt: account.updatedAt || 0,
    fmCooldownUntil: account.fmCooldownUntil || 0,
    tencentCooldownUntil: account.tencentCooldownUntil || 0,
    identity: parseIdentity(account.cookie, account.userInfo),
} : null

export const createTencentFmLogger = (ctx, explicitCookie, recordLog) => {
    const preferredCookieId = store.getFmPriorityCookieId('tencent') || ''
    const preferred = preferredCookieId ? store.getCookie(preferredCookieId) : null
    const preferredState = accountState(preferred)
    const traceId = store.generateId()
    const startedAt = Date.now()
    const source = explicitCookie ? 'explicit' : 'stored'
    let initialCookieId = ''
    const selectionReason = selected => {
        if (explicitCookie) return 'explicit_cookie'
        if (!preferredCookieId) return 'no_preference'
        if (selected?.id === preferredCookieId) return 'preferred_selected'
        if (!preferred) return 'preferred_missing'
        if (preferred.platform !== 'tencent') return 'preferred_platform_mismatch'
        if (!preferred.isActive) return 'preferred_inactive'
        if (preferred.isValid === false) return 'preferred_invalid'
        if (Number(preferred.tencentCooldownUntil) > startedAt) return 'preferred_slider_cooldown'
        if (Number(preferred.fmCooldownUntil) > startedAt) return 'preferred_fm_cooldown'
        return 'preferred_not_selected'
    }
    return async (event, account, details = {}) => {
        if (event === 'selection') initialCookieId = account?.id || ''
        const diagnostic = {
            traceId, event, source, preferredCookieId, preferredState, initialCookieId,
            cookieId: account?.id || '',
            switched: !explicitCookie && Boolean(account && (
                (preferredCookieId && account.id !== preferredCookieId)
                || (initialCookieId && account.id !== initialCookieId)
            )),
            identity: parseIdentity(explicitCookie || account?.cookie, account?.userInfo),
            accountState: accountState(account),
            elapsedMs: Date.now() - startedAt,
            ...(event === 'selection' ? { reason: selectionReason(account) } : {}),
            ...details,
        }
        console.info('[Meting][QQ-FM]', JSON.stringify(diagnostic))
        await recordLog({
            method: ctx.req.method || 'GET',
            path: ctx.req.path || '/api',
            platform: 'tencent',
            category: 'fm_trace',
            status: 200,
            level: ['error', 'empty'].includes(event) || diagnostic.switched ? 'warning' : 'info',
            code: 'FM_TENCENT_TRACE',
            ...diagnostic,
            // 后台沿用错误详情列展示诊断信息，内容仅包含白名单字段
            error: `QQ FM ${event} ${JSON.stringify(diagnostic)}`,
        })
    }
}
