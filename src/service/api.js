import Providers from "../providers/index.js"
import { format as lyricFormat, get_url } from "../util.js"
import { wrapQishuiPlayPayload } from "../providers/qishui/audio.js"
import store, { selectRequestCookie } from "../admin/store.js"
import { isValidQuality, getQualityName, buildUrlPayload } from "../quality.js"
import { resolveQishuiSignerUrl } from './qishui-signer-config.js'
import config from '../config.js'
import { fetchAuxiliaryLoudness, needsStandardLoudnessUrl, shouldFetchAuxiliaryLoudness } from './loudness.js'
import { resolveLoudnessServiceUrl } from './loudness-config.js'
import { parseNeteasePagination } from './netease-pagination.js'

const recordApiLog = async (log) => {
    try {
        await store.addApiLog(log)
    } catch (error) {
        console.warn('[Meting] 接口日志写入失败', error?.message || error)
    }
}
import { getStructuredLyrics } from './structured-lyrics.js'
export default async (ctx) => {

    const p = new Providers()

    const query = ctx.req.query()
    const server = query.server || 'netease'
    const type = query.type || 'playlist'
    const id = query.id || '6907557348'
    const quality = query.quality?.toLowerCase()
    const wantRedirect = query.redirect === '1' || query.redirect === 'true'
    const explicitCookie = String(ctx.req.header('X-OpenMusic-Cookie') || '').trim()
    const fmUrl = type === 'url' && query.fm === '1' && !explicitCookie

    if (type === 'lrc' && query.format === 'json' && !/^[a-z0-9_-]{1,256}$/i.test(id)) {
        return ctx.json({ error: 'invalid lyric id', code: 'INVALID_LYRIC_ID' }, 400)
    }

    if (!p.get_provider_list().includes(server) || !p.get(server).support_type.includes(type)) {
        ctx.status(400)
        return ctx.json({ status: 400, message: 'server 参数不合法', param: { server, type, id } })
    }

    if (!isValidQuality(server, quality)) {
        ctx.status(400)
        return ctx.json({ status: 400, message: 'quality 参数不合法', param: { server, quality } })
    }

    const pagination = parseNeteasePagination(query, server, type)
    if (pagination === null) {
        ctx.status(400)
        return ctx.json({ status: 400, message: '分页参数不合法：limit 为 1-100，page 从 1 开始，offset 从 0 开始' })
    }

    let cookie = explicitCookie
    let storedCookie = null

    // 显式 Cookie 始终优先；没有显式 Cookie 时才应用 FM 优先账号策略。
    if (!explicitCookie) {
        if (type === 'fm') {
            storedCookie = store.getActiveCookieForFm(server)
        } else if (type === 'url') {
            storedCookie = store.getActiveCookieForQuality(server, quality || 'standard', query.fm === '1')
        } else {
            storedCookie = store.getActiveCookie(server)
        }
    }

    cookie = selectRequestCookie(explicitCookie, storedCookie)
    ctx.set?.('apiLogContext', { platform: server, cookieId: storedCookie?.id || '' })
    if (type === 'url' && !explicitCookie && !storedCookie) {
        ctx.status(403)
        return ctx.json({ error: 'no url' })
    }

    const signerUrl = server === 'qishui' ? resolveQishuiSignerUrl(store.getQishuiSignerUrl()) : ''
    if (server === 'qishui' && type === 'url') {
        console.log('[Meting] qishui signer config', JSON.stringify({
            configured: Boolean(signerUrl),
            source: store.getQishuiSignerUrl() ? 'admin' : (process.env.QISHUI_SIGNER_URL ? 'env' : 'none'),
        }))
    }
    const requiresSvip = type === 'url' && Boolean(quality) && store.isQualityRequiresSvip(quality, server)
    let data
    if (type === 'fm' && !explicitCookie) {
        const attemptedIds = []
        let currentCookie = storedCookie
        while (currentCookie) {
            attemptedIds.push(currentCookie.id)
            try {
                data = await p.get(server).handle(type, id, currentCookie.cookie, { quality, signerUrl, ...pagination })
                if (Array.isArray(data) && data.length) {
                    storedCookie = currentCookie
                    cookie = currentCookie.cookie
                    ctx.set?.('apiLogContext', { platform: server, cookieId: currentCookie.id })
                    await store.recordCookieRequestSuccess(currentCookie.id)
                    await store.recordCookieFmSuccess(currentCookie.id)
                    break
                }
                await store.recordCookieFmFailure(currentCookie.id)
                await recordApiLog({
                    method: ctx.req.method,
                    path: ctx.req.path,
                    status: 200,
                    level: 'warning',
                    code: 'FM_EMPTY_RESULT',
                    platform: server,
                    cookieId: currentCookie.id,
                    preferred: attemptedIds.length === 1,
                    error: 'FM 账号返回空列表',
                })
            } catch (error) {
                await store.recordCookieFmFailure(currentCookie.id)
                await recordApiLog({
                    method: ctx.req.method,
                    path: ctx.req.path,
                    status: 200,
                    level: 'warning',
                    code: 'FM_ACCOUNT_FAILED',
                    platform: server,
                    cookieId: currentCookie.id,
                    preferred: attemptedIds.length === 1,
                    error: error?.message || 'FM 账号请求失败',
                })
            }
            try {
                currentCookie = store.getFallbackCookieForFm(server, attemptedIds)
            } catch (error) {
                await recordApiLog({
                    method: ctx.req.method,
                    path: ctx.req.path,
                    status: 200,
                    level: 'error',
                    code: 'FM_FAILOVER_FAILED',
                    platform: server,
                    error: error?.message || 'FM 账号分流失败',
                })
                currentCookie = null
            }
        }
        data = Array.isArray(data) ? data : []
    } else {
        try {
            data = await p.get(server).handle(type, id, cookie, { quality, signerUrl, ...pagination })
        } catch (error) {
        if (type === 'lrc' && query.format === 'json' && ['netease', 'tencent', 'kugou'].includes(server)) {
            console.warn(`[Lyrics] ${server} ordinary lyric unavailable, trying word timing`)
            return ctx.json(await getStructuredLyrics(server, id, cookie, {}))
        }
        if (type === 'url') {
            data = null
        } else if (type === 'fm') {
            await recordApiLog({
                method: ctx.req.method,
                path: ctx.req.path,
                status: 200,
                level: 'warning',
                code: 'FM_EXPLICIT_ACCOUNT_FAILED',
                platform: server,
                error: error?.message || 'FM 账号请求失败',
            })
            data = []
        } else {
            if ((!requiresSvip && !fmUrl && !(server === 'tencent' && type === 'url')) || !storedCookie) throw error
        }
        }
    }

    if (type === 'url') {
        // 兼容旧返回：纯字符串 URL
        let payload = typeof data === 'string'
            ? buildUrlPayload(data, quality || 'standard', quality || 'standard', server)
            : data

        let url = payload?.url || ''
        if (!url && storedCookie) {
            const attemptedIds = []
            const attemptedCookies = new Set()
            while (!url && storedCookie) {
                attemptedIds.push(storedCookie.id)
                attemptedCookies.add(cookie)
                await store.recordCookieUrlFailure(storedCookie.id, id, Boolean(payload?.verificationRequired))
                let fallbackCookie = null
                try {
                    fallbackCookie = store.getFallbackCookieForQuality(server, quality || 'standard', attemptedIds)
                } catch (error) {
                    await recordApiLog({
                        method: ctx.req.method,
                        path: ctx.req.path,
                        status: 200,
                        level: 'error',
                        code: 'URL_FAILOVER_FAILED',
                        platform: server,
                        error: error?.message || '歌曲链接账号分流失败',
                    })
                }
                if (!fallbackCookie || attemptedCookies.has(fallbackCookie.cookie)) break
                storedCookie = fallbackCookie
                cookie = fallbackCookie.cookie
                ctx.set?.('apiLogContext', { platform: server, cookieId: fallbackCookie.id })
                data = null
                try {
                    data = await p.get(server).handle(type, id, cookie, { quality, signerUrl })
                } catch {}
                payload = typeof data === 'string'
                    ? buildUrlPayload(data, quality || 'standard', quality || 'standard', server)
                    : data
                url = payload?.url || ''
            }
        }
        if (!url) {
            console.warn('[Meting] no url', JSON.stringify({
                server,
                type,
                id,
                requestedQuality: quality || 'standard',
                hasActiveCookie: Boolean(cookie),
                cookieValid: storedCookie?.isValid !== false,
                cookieVip: Boolean(storedCookie?.userInfo?.canPlayVip),
                cookieSvip: Boolean(storedCookie?.userInfo?.canPlaySvip),
            }))
            ctx.status(403)
            return ctx.json({ error: 'no url' })
        }
        if (server === 'qishui' && payload?.auth) {
            const wrapped = wrapQishuiPlayPayload(ctx, payload)
            url = wrapped.url || url
            payload.url = url
        }
        if (url.startsWith('@')) {
            if (storedCookie) await store.recordCookieRequestSuccess(storedCookie.id)
            return ctx.text(url)
        }
        if (storedCookie) await store.recordCookieRequestSuccess(storedCookie.id)
        if (server === 'tencent' && storedCookie) await store.recordCookieUrlSuccess(storedCookie.id)

        const loudnessServiceUrl = resolveLoudnessServiceUrl(store.getLoudnessServiceUrl(), config.LOUDNESS_SERVICE_URL)
        if (shouldFetchAuxiliaryLoudness(loudnessServiceUrl, wantRedirect)) {
            let loudnessAudioUrl = url
            if (needsStandardLoudnessUrl(quality)) {
                try {
                    const standardData = await p.get(server).handle('url', id, cookie, { quality: 'standard', signerUrl })
                    if (server === 'tencent' && storedCookie && standardData?.verificationRequired) {
                        await store.recordCookieUrlFailure(storedCookie.id, id, true)
                    }
                    const standardPayload = typeof standardData === 'string'
                        ? buildUrlPayload(standardData, 'standard', 'standard', server)
                        : standardData
                    loudnessAudioUrl = standardPayload?.url || ''
                    if (server === 'qishui' && standardPayload?.auth && loudnessAudioUrl) {
                        loudnessAudioUrl = wrapQishuiPlayPayload(ctx, { ...standardPayload, url: loudnessAudioUrl }).url || loudnessAudioUrl
                    }
                } catch (error) {
                    loudnessAudioUrl = ''
                    console.warn('[Meting] standard loudness URL skipped:', error?.message || error)
                }
            }
            const auxiliaryLoudness = await fetchAuxiliaryLoudness({
                serviceUrl: loudnessServiceUrl,
                audioUrl: loudnessAudioUrl,
                songId: id,
            })
            if (auxiliaryLoudness) payload.loudness = auxiliaryLoudness
        }

        // 默认 JSON：url + 实际音质；redirect=1 时 302，兼容 Meting 等播放器
        if (wantRedirect) {
            return ctx.redirect(url)
        }

        return ctx.json({
            url,
            quality: payload.quality || getQualityName(quality || 'standard', server),
            duration: payload.duration,
            loudness: payload.loudness || null,
        })
    }

    if (storedCookie && type !== 'fm' && type !== 'url') {
        await store.recordCookieRequestSuccess(storedCookie.id)
    }

    if (type === 'pic') {
        return ctx.redirect(data)
    }

    if (type === 'lrc') {
        if (query.format === 'json') return ctx.json(await getStructuredLyrics(server, id, cookie, data))
        return ctx.text(lyricFormat(data.lyric, data.tlyric || ''))
    }


    return ctx.json(data.map(x => {
        for (let i of ['url', 'pic', 'lrc']) {
            const _ = String(x[i])
            if (!_.startsWith('@') && !_.startsWith('http') && _.length > 0) {
                const qualityParam = i === 'url' && quality ? `&quality=${quality}` : ''
                const fmParam = i === 'url' && type === 'fm' ? '&fm=1' : ''
                const redirectParam = i === 'url' ? '&redirect=1' : ''
                let linkType = i
                if (i === 'url') {
                    if (type === 'search_playlist') linkType = 'playlist'
                    else if (type === 'dj_hot' || type === 'dj_detail' || type === 'search_dj') linkType = 'dj'
                }
                x[i] = `${get_url(ctx)}?server=${server}&type=${linkType}&id=${_}${qualityParam}${fmParam}${redirectParam}`
            }
        }
        return x
    }))
}
