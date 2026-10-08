import { changeUrlQuery } from "./util.js"
import config from "../../config.js"
import { buildUrlPayload } from "../../quality.js"

/**
 * QQ 音乐音质前缀（对齐官方档位）
 * filename：{前缀}{songmid}{media_mid}{后缀}
 * 标准品质 M500 / HQ高品质 M800 / SQ无损 F000 /
 * 臻品全景声 Q000 / 臻品母带 AI00
 * 官方另有 dtsX（音效）、NAC（省流），本 API 不提供
 */
const QUALITY_MAP = {
    '128': { s: 'M500', e: '.mp3', sizeKey: 'size_128mp3' },
    'standard': { s: 'M500', e: '.mp3', sizeKey: 'size_128mp3' },
    '320': { s: 'M800', e: '.mp3', sizeKey: 'size_320mp3' },
    'exhigh': { s: 'M800', e: '.mp3', sizeKey: 'size_320mp3' },
    'flac': { s: 'F000', e: '.flac', sizeKey: 'size_flac' },
    'lossless': { s: 'F000', e: '.flac', sizeKey: 'size_flac' },
    'atmos': { s: 'Q000', e: '.flac', sizeKey: 'size_dolby', sizeNewIndex: 1 },
    'master': { s: 'AI00', e: '.flac', sizeNewIndex: 0 },
}

/** 由高到低：臻品母带 → 臻品全景声 → SQ → HQ → 标准 */
const FALLBACK_CHAIN = [
    'master',
    'atmos',
    'flac',
    'exhigh',
    'standard',
]

// ponytail: process-local challenges; use shared storage only for multi-process deployments.
const pendingVerifications = new Map()

export const getTencentVerification = (cookie) => {
    const pending = pendingVerifications.get(cookie)
    if (!pending) return null
    if (Date.now() - pending.createdAt < 5 * 60 * 1000) return { songmid: pending.songmid, validUrl: pending.validUrl }
    pendingVerifications.delete(cookie)
    return null
}

const resolveQuality = (quality) => {
    if (!quality) return QUALITY_MAP['128']
    return QUALITY_MAP[quality.toLowerCase()] || QUALITY_MAP['128']
}

const parseCookieString = (cookieString) => {
    if (!cookieString) return {}
    const cookies = {}
    cookieString.split(';').forEach(item => {
        const idx = item.indexOf('=')
        if (idx <= 0) return
        const key = item.slice(0, idx).trim()
        const value = item.slice(idx + 1).trim()
        if (key && value) cookies[key] = value
    })
    return cookies
}

export const mergeTencentTrackAudioMeta = (track) => {
    if (!track?.file) return null
    return {
        ...track.file,
        volume: track.volume,
        duration: Number(track.interval || 0) * 1000 || undefined,
    }
}

const get_track_file = async (songmid) => {
    try {
        const data = {
            data: JSON.stringify({
                songinfo: {
                    method: 'get_song_detail_yqq',
                    module: 'music.pf_song_detail_svr',
                    param: { song_mid: songmid },
                },
            }),
        }
        const url = changeUrlQuery(data, 'https://u.y.qq.com/cgi-bin/musicu.fcg')
        const result = await (await fetch(url)).json()
        return mergeTencentTrackAudioMeta(result?.songinfo?.data?.track_info)
    } catch {
        return null
    }
}

const hasQualityFile = (file, qualityKey) => {
    if (!file) return true // 拿不到详情时不拦截，交给 vkey / CDN 校验
    const q = QUALITY_MAP[qualityKey]
    if (!q) return false
    if (q.sizeKey && Number(file[q.sizeKey]) > 0) return true
    if (typeof q.sizeNewIndex === 'number') {
        const sizeNew = file.size_new
        if (Array.isArray(sizeNew) && Number(sizeNew[q.sizeNewIndex]) > 0) return true
    }
    // 有明确 size 字段且为 0，则判定无此音质
    if (q.sizeKey && file[q.sizeKey] !== undefined) return Number(file[q.sizeKey]) > 0
    if (typeof q.sizeNewIndex === 'number') {
        const sizeNew = file.size_new
        if (Array.isArray(sizeNew)) return Number(sizeNew[q.sizeNewIndex] || 0) > 0
    }
    return true
}

const buildFallbackLevels = (requestedKey) => {
    const key = requestedKey.toLowerCase()
    const alias = {
        '128': 'standard',
        '320': 'exhigh',
        'lossless': 'flac',
    }
    const normalized = alias[key] || key
    const idx = FALLBACK_CHAIN.indexOf(normalized)
    if (idx === -1) return [normalized, 'flac', 'exhigh', 'standard']
    return FALLBACK_CHAIN.slice(idx)
}

const fetchVkeyUrl = async (songmid, mediaMid, typeObj, uin, authst, cookie) => {
    const filename = [`${typeObj.s}${songmid}${mediaMid}${typeObj.e}`]
    const guid = (Math.random() * 10000000).toFixed(0)

    const data = {
        req_0: {
            module: 'vkey.GetVkeyServer',
            method: 'CgiGetVkey',
            param: {
                filename,
                guid,
                songmid: [songmid],
                songtype: [0],
                uin,
                loginflag: 1,
                platform: '20',
            },
        },
        comm: {
            uin,
            format: 'json',
            ct: 19,
            cv: 0,
            authst,
        },
    }

    const params = {
        '-': 'getplaysongvkey',
        g_tk: 5381,
        loginUin: uin,
        hostUin: 0,
        format: 'json',
        inCharset: 'utf8',
        outCharset: 'utf-8¬ice=0',
        platform: 'yqq.json',
        needNewCode: 0,
        data: JSON.stringify(data),
    }

    if (config.OVERSEAS) {
        params.format = 'jsonp'
        const callback_function_name = 'callback'
        const callback_name = 'callback'
        const parse_function = 'qq_get_url_from_json'
        const url = changeUrlQuery(params, 'https://u.y.qq.com/cgi-bin/musicu.fcg')
        return { overseas: true, url: '@' + parse_function + '@' + callback_name + '@' + callback_function_name + '@' + url }
    }

    const url = changeUrlQuery(params, 'https://u.y.qq.com/cgi-bin/musicu.fcg')
    const result = await (await fetch(url)).json()
    const info = result?.req_0?.data?.midurlinfo?.[0]
    const purl = info?.purl || ''

    const verificationRequired = [result?.code, result?.req_0?.code, result?.req_0?.data?.retcode, info?.result]
        .some(code => Number(code) === 104009)
    if (verificationRequired) {
        try {
            const validUrl = new URL(String(result.req_0.data.validUrl).replace(/\\([:/_])/g, '$1'))
            if (validUrl.protocol === 'https:' && validUrl.hostname === 'c.y.qq.com') {
                pendingVerifications.set(cookie, { songmid, validUrl: validUrl.href, createdAt: Date.now() })
            }
        } catch {}
    }

    // 104003 无权限；空 purl；或 result 非 0 都视为失败
    if (verificationRequired || !purl || (info?.result !== undefined && info.result !== 0)) {
        return { url: '', verificationRequired }
    }

    const domain =
        result.req_0.data.sip.find(i => !i.startsWith('http://ws')) ||
        result.req_0.data.sip[0]

    return { url: `${domain}${purl}`.replace('http://', 'https://') }
}

/** QQ 对不存在的高音质有时仍返回 purl，需探测 CDN 是否真实可播 */
const isPlayableUrl = async (url) => {
    if (!url || url.startsWith('@')) return !!url
    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                Range: 'bytes=0-1',
                Referer: 'https://y.qq.com/',
                'User-Agent': 'Mozilla/5.0',
            },
        })
        return res.status === 200 || res.status === 206
    } catch {
        return false
    }
}

export const get_song_url = async (id, cookie = '', options = {}) => {
    const ids = id.split(',')
    const cookieObj = parseCookieString(cookie)
    const uin = cookieObj.uin || cookieObj.wxuin || ''
    const authst = cookieObj.qqmusic_key || cookieObj.qm_keyst || ''
    const requested = (options.quality || '128').toLowerCase()
    const levels = buildFallbackLevels(requested)

    // 批量时保持旧行为（海外 JSONP 或多 id）
    if (config.OVERSEAS || ids.length > 1) {
        const typeObj = resolveQuality(requested)
        const mediaMids = await Promise.all(ids.map(async (mid) => {
            const file = await get_track_file(mid)
            return file?.media_mid || mid
        }))
        const filename = ids.map((mid, i) => `${typeObj.s}${mid}${mediaMids[i]}${typeObj.e}`)
        const guid = (Math.random() * 10000000).toFixed(0)
        const data = {
            req_0: {
                module: 'vkey.GetVkeyServer',
                method: 'CgiGetVkey',
                param: {
                    filename,
                    guid,
                    songmid: ids,
                    songtype: new Array(ids.length).fill(0),
                    uin,
                    loginflag: 1,
                    platform: '20',
                },
            },
            comm: { uin, format: 'json', ct: 19, cv: 0, authst },
        }
        const params = {
            '-': 'getplaysongvkey',
            g_tk: 5381,
            loginUin: uin,
            hostUin: 0,
            format: 'jsonp',
            inCharset: 'utf8',
            outCharset: 'utf-8¬ice=0',
            platform: 'yqq.json',
            needNewCode: 0,
            data: JSON.stringify(data),
        }
        const url = changeUrlQuery(params, 'https://u.y.qq.com/cgi-bin/musicu.fcg')
        return buildUrlPayload('@qq_get_url_from_json@callback@callback@' + url, requested, requested, 'tencent')
    }

    const songmid = ids[0]
    const file = await get_track_file(songmid)
    const mediaMid = file?.media_mid || songmid

    for (const level of levels) {
        const typeObj = QUALITY_MAP[level]
        if (!typeObj) continue
        if (!hasQualityFile(file, level)) {
            console.log(`[tencent] quality ${level} not in file meta for ${songmid}, skip`)
            continue
        }

        try {
            const { url, verificationRequired } = await fetchVkeyUrl(songmid, mediaMid, typeObj, uin, authst, cookie)
            if (verificationRequired) return { url: '', verificationRequired: true }
            if (!url) continue

            const ok = await isPlayableUrl(url)
            if (!ok) {
                console.log(`[tencent] quality ${level} vkey ok but CDN unusable for ${songmid}`)
                continue
            }

            if (QUALITY_MAP[requested]?.s !== typeObj.s) {
                console.log(`[tencent] quality ${requested} unavailable for ${songmid}, fallback to ${level}`)
            }
            pendingVerifications.delete(cookie)
            return buildUrlPayload(url, level, requested, 'tencent', file?.volume, file?.duration)
        } catch (e) {
            console.error(`[tencent] fetch url level=${level} failed:`, e?.message || e)
        }
    }

    return null
}

export const get_song_info = async (id, cookie = '') => {
    const data = {
        data: JSON.stringify({
            songinfo: {
                method: 'get_song_detail_yqq',
                module: 'music.pf_song_detail_svr',
                param: {
                    song_mid: id,
                },
            },
        }),
    };

    const url = changeUrlQuery(data, 'http://u.y.qq.com/cgi-bin/musicu.fcg');

    let result = await fetch(url);

    result = await result.json()

    result = result.songinfo.data

    let song_info = {
        author: result.track_info.singer.reduce((i, v) => ((i ? i + " / " : i) + v.name), ''),
        title: result.track_info.name,
        pic: `https://y.gtimg.cn/music/photo_new/T002R300x300M000${result.track_info.album.mid}.jpg`,
        url: config.OVERSEAS ? ((await get_song_url(id))?.url || '') : id,
        lrc: id,
        songmid: id,
        duration: Number(result.track_info.interval || 0) * 1000 || undefined,
    }
    return [song_info]
}

export const get_pic = async (id, cookie = '') => {
    const info = await get_song_info(id, cookie)
    return info[0].pic
}
