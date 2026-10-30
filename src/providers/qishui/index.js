import { createHash, randomBytes } from 'node:crypto'
import { normalizeLoudness } from '../../quality.js'
import { generateQishuiSignatureHeaders, isQishuiRemoteSignerConfigured } from './signature.js'

const PUBLIC_SEARCH = 'https://api-vehicle.volcengine.com/v2/search/type'
const PUBLIC_DETAIL = 'https://api-vehicle.volcengine.com/v2/custom/contents'
const PC_API = 'https://api.qishui.com'
const LUNA_API = 'https://beta-luna.douyin.com'

// 扫码拿到的是 Passport 网页会话，PC 接口必须使用与 qishui-api 一致的
// 稳定客户端指纹；每次请求重新生成设备参数会触发“应用版本有风险”。
const WEB_UA = 'LunaPC/3.3.0(359450208)'
const PLAYLIST_WEB_UA = 'LunaPC/3.6.0(424921879)'
const STREAM_WEB_UA = 'LunaPC/3.0.0(290101097)'
const LUNA_ANDROID_UA = 'Luna/19.1.0 Android'
const stablePcId = () => `${Date.now()}${randomBytes(2).readUInt16BE(0).toString().padStart(5, '0')}`.slice(0, 16)
const PC_DEVICE_ID = stablePcId()
const PC_INSTALL_ID = stablePcId()
const PC_FP = PC_DEVICE_ID
const ANDROID_DEVICE_ID = stablePcId()
const ANDROID_INSTALL_ID = stablePcId()

// song-tab 的推荐上下文需要跨请求保留；只保存不可逆的账号指纹和歌曲 ID，不保存 Cookie。
const feedSessions = new Map()
const FEED_SESSION_LIMIT = 80

const text = (value) => String(value ?? '').trim()
const object = (...values) => values.find(value => value && typeof value === 'object' && !Array.isArray(value)) || {}
const array = (...values) => values.find(Array.isArray) || []

const loudnessFromNode = (node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return undefined
    const hasPeak = node.peak !== undefined || node.volume_peak !== undefined
    const hasGain = node.gain !== undefined || node.loudness !== undefined
    if (!hasPeak || !hasGain) return undefined
    return normalizeLoudness({
        gain: node.gain ?? node.loudness,
        peak: node.peak ?? node.volume_peak,
    })
}

/** 从汽水原生响应中读取 VolumeInfo；不把智能音效链的 gain_db 当作歌曲响度。 */
export const mapQishuiLoudness = (payload) => {
    const seen = new Set()
    const visit = (node, depth = 0) => {
        if (!node || typeof node !== 'object' || depth > 8 || seen.has(node)) return undefined
        seen.add(node)
        if (Array.isArray(node)) {
            for (const item of node.slice(0, 250)) {
                const result = visit(item, depth + 1)
                if (result) return result
            }
            return undefined
        }
        const direct = loudnessFromNode(node)
        if (direct) return direct
        for (const [key, value] of Object.entries(node).slice(0, 250)) {
            if (/^(?:volume[_-]?info|loudness[_-]?info)$/i.test(key) && value && typeof value === 'object') {
                const result = loudnessFromNode(value)
                if (result) return result
            }
            const result = visit(value, depth + 1)
            if (result) return result
        }
        return undefined
    }
    return visit(payload)
}

const feedSessionKey = (cookie, mode) => {
    const input = `${normalizeCookie(cookie)}|${text(mode).toUpperCase()}`
    let hash = 2166136261
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i)
        hash = Math.imul(hash, 16777619)
    }
    return `${hash >>> 0}`
}

const normalizeCookie = (raw) => {
    const values = new Map()
    text(raw).split(';').forEach(part => {
        const index = part.indexOf('=')
        if (index <= 0) return
        const key = part.slice(0, index).trim()
        const value = part.slice(index + 1).trim()
        if (key && value) values.set(key, value)
    })
    return [...values].map(([key, value]) => `${key}=${value}`).join('; ')
}

export const qishuiCookieHasLogin = (raw) => {
    const cookie = normalizeCookie(raw).toLowerCase()
    // Passport 确认后可能只下发 sessionid_ss；它是汽水当前网页登录态的一部分。
    return /(?:^|;\s*)(?:sessionid|sessionid_ss|sid_guard|sid_tt)=/.test(cookie)
}

const pcParams = (extra = {}) => {
    return {
        aid: '386088', app_name: 'luna_pc', region: 'cn', geo_region: 'cn', os_region: 'cn',
        sim_region: '', device_id: PC_DEVICE_ID, cdid: '',
        version_name: '3.3.0', version_code: '359450208', channel: 'official', build_mode: 'master',
        network_carrier: '', ac: 'wifi', tz_name: 'Asia/Shanghai', resolution: '',
        device_platform: 'windows', device_type: 'Windows', os_version: 'Windows 11', fp: PC_FP,
        iid: PC_INSTALL_ID,
        ...extra,
    }
}

const streamPcParams = (extra = {}) => pcParams({
    version_name: '3.0.0',
    version_code: '30000000',
    ...extra,
})

const mediaPlayerAndroidParams = (extra = {}) => ({
    aid: '386088', app_name: 'luna', region: 'cn', geo_region: 'cn', os_region: 'cn', sim_region: '',
    device_id: ANDROID_DEVICE_ID, iid: ANDROID_INSTALL_ID, cdid: '',
    version_name: '19.1.0', version_code: '19010000', channel: 'official', build_mode: 'release',
    network_carrier: '', ac: 'wifi', tz_name: 'Asia/Shanghai', resolution: '',
    device_platform: 'android', device_type: 'Pixel 8', os_version: '15', fp: ANDROID_DEVICE_ID,
    ...extra,
})

const urlWithParams = (base, params, { includeEmpty = false } = {}) => {
    const url = new URL(base)
    Object.entries(params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && (includeEmpty || value !== '')) {
            url.searchParams.set(key, String(value))
        }
    })
    return url.toString()
}

const cookieDiagnostic = (raw) => {
    const normalized = normalizeCookie(raw)
    if (!normalized) return ''
    const names = normalized.split(';').map(part => part.split('=')[0].trim()).filter(Boolean)
    return `<redacted; ${normalized.length} chars; keys=${names.join(',')}>`
}

const rawRequestLines = ({ method, url, headers, bodyText }) => {
    const requestUrl = new URL(url)
    const requestHeaders = Object.entries(headers).map(([name, value]) => {
        return `${name}: ${name.toLowerCase() === 'cookie' ? cookieDiagnostic(value) : value}`
    })
    return [
        `${method} ${requestUrl.pathname}${requestUrl.search} HTTP/1.1`,
        `Host: ${requestUrl.host}`,
        ...requestHeaders,
        '',
        bodyText || '',
    ]
}

const printRawRequest = (request, label) => {
    console.log([`[Qishui] ${label} 原始请求`, ...rawRequestLines(request)].join('\n'))
}

const requestJson = async (url, {
    cookie = '', method = 'GET', body, timeout = 10000, headers: extraHeaders = {}, signatureDeviceId = '', signatureUrl = '', debugRaw = false, debugLabel = 'track_v2',
} = {}) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
        const bodyText = body === undefined ? undefined : JSON.stringify(body)
        const traceId = `00-${randomBytes(16).toString('hex')}-${randomBytes(8).toString('hex')}-01`
        const headers = {
                Accept: 'application/json,text/plain,*/*',
                'Content-Type': 'application/json; charset=utf-8',
                'User-Agent': WEB_UA,
                Referer: 'https://www.qishui.com/',
                'x-luna-background-type': 'foreground',
                'x-luna-is-background-req': '0',
                'x-luna-is-local-user': '1',
                'x-tt-trace-id': traceId,
                ...(bodyText ? { 'X-SS-STUB': createHash('md5').update(bodyText).digest('hex').toUpperCase() } : {}),
                ...(cookie ? { Cookie: normalizeCookie(cookie) } : {}),
                ...extraHeaders,
        }
        if (signatureDeviceId) {
            Object.assign(headers, await generateQishuiSignatureHeaders({ url, headers, deviceId: signatureDeviceId, signerUrl: signatureUrl }))
        }
        if (debugRaw) printRawRequest({ method, url, headers, bodyText }, debugLabel)
        let response
        try {
            response = await fetch(url, {
                method,
                body: bodyText,
                signal: controller.signal,
                headers,
            })
        } catch (error) {
            if (debugRaw) {
                const cause = error?.cause
                console.error(`[Qishui] ${debugLabel} 请求异常`, JSON.stringify({
                    name: error?.name || '',
                    message: error?.message || String(error),
                    causeName: cause?.name || '',
                    causeMessage: cause?.message || '',
                    causeCode: cause?.code || '',
                    causeErrno: cause?.errno || '',
                    causeSyscall: cause?.syscall || '',
                    causeAddress: cause?.address || '',
                    causePort: cause?.port || '',
                    stack: error?.stack || '',
                    causeStack: cause?.stack || '',
                }))
            }
            throw error
        }
        const responseText = await response.text()
        if (!response.ok) throw Object.assign(new Error(`汽水接口返回 ${response.status}`), { status: response.status })
        if (!responseText.trim()) {
            const cookieKeys = normalizeCookie(cookie).split(';').map(part => part.split('=')[0].trim()).filter(Boolean)
            const hasPcSession = cookieKeys.some(name => /^(sessionid|sid_tt|sid_guard|odin_tt)$/i.test(name))
            const hint = hasPcSession ? '' : '（Cookie 缺少 PC 会话字段 sessionid/sid_tt/sid_guard/odin_tt）'
            throw new Error(`汽水接口返回空响应: ${new URL(url).pathname}${hint}`)
        }
        let json
        try {
            json = JSON.parse(responseText)
        } catch {
            throw new Error(`汽水接口返回无效 JSON: ${new URL(url).pathname}`)
        }
        const status = object(json?.status_info, json?.statusInfo)
        const code = Number(status.status_code ?? status.statusCode ?? json?.status_code ?? 0)
        if (code) throw new Error(text(status.status_msg || status.statusMsg || json?.message || `汽水状态码 ${code}`))
        return json
    } finally {
        clearTimeout(timer)
    }
}

const joinUrl = (base, path) => `${text(base).replace(/\/+$/, '')}/${text(path).replace(/^\/+/, '')}`

// 汽水图片接口返回的是“域名目录 + uri + 模板参数”，不能只取 url_list
// 里的目录，否则前端拿到的地址只会停在 /img/，浏览器无法显示封面。
const imageDescriptorUrl = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
    const uri = text(value.uri || value.image_uri || value.imageUri)
    const bases = value.url_list || value.urlList || value.urls
    if (!uri || !Array.isArray(bases)) return ''
    const base = bases.find((item) => typeof item === 'string' && /^https?:\/\//i.test(item))
    if (!base) return ''
    const prefix = text(value.template_prefix || value.templatePrefix)
    const suffix = prefix ? `~${prefix}-crop-center:192:192.jpg` : ''
    return joinUrl(base, `${uri}${suffix}`)
}

const firstUrl = (value) => {
    if (typeof value === 'string' && /^https?:\/\//i.test(value)) return value
    if (Array.isArray(value)) return value.map(firstUrl).find(Boolean) || ''
    if (value && typeof value === 'object') {
        return imageDescriptorUrl(value)
            || firstUrl(value.url_list || value.urlList || value.urls || value.uri || value.url)
    }
    return ''
}

const collectMedia = (payload) => {
    const wrapped = payload?.data
    const root = wrapped && typeof wrapped === 'object'
        && ['items', 'tracks', 'track_list', 'songs', 'media_resources'].some(key => Array.isArray(wrapped[key]))
        ? wrapped
        : payload || {}
    const direct = array(
        root.media_resources, root.media_list, root.related_media, root.medias, root.media,
        root.tracks, root.track_list, root.songs, root.items, root.list, root.result,
        root.song_list, root.recommend_media_list,
    )
    if (direct.length) return direct
    let best = []
    const visit = (node, depth = 0) => {
        if (!node || depth > 5) return
        if (Array.isArray(node)) {
            const media = node.filter(item => item && typeof item === 'object' && (
                item.media || item.track_entity || item.entity || item.base_info || item.item_id || item.id
            ))
            if (media.length > best.length) best = media
            node.slice(0, 100).forEach(item => visit(item, depth + 1))
            return
        }
        if (typeof node === 'object') Object.values(node).slice(0, 100).forEach(item => visit(item, depth + 1))
    }
    visit(root)
    return best
}

const seconds = (value) => {
    const number = Number(value) || 0
    return number > 10000 ? Math.round(number / 1000) : Math.round(number)
}

const artistText = (...values) => {
    const names = []
    const seen = new Set()
    const visit = (value, depth = 0) => {
        if (!value || depth > 4) return
        if (typeof value === 'string') {
            const name = text(value)
            if (name && !seen.has(name)) { seen.add(name); names.push(name) }
            return
        }
        if (Array.isArray(value)) {
            value.slice(0, 20).forEach(item => visit(item, depth + 1))
            return
        }
        if (typeof value !== 'object') return
        const direct = text(value.name || value.artist_name || value.author_name || value.nickname)
        if (direct && !seen.has(direct)) { seen.add(direct); names.push(direct) }
        ;[
            value.artist, value.artists, value.artist_info, value.artist_links,
            value.author, value.authors, value.author_info,
            value.singer, value.singers, value.singer_info,
            value.entity, value.link,
        ].forEach(item => visit(item, depth + 1))
    }
    values.forEach(value => visit(value))
    return names.join(' / ')
}

const mapMedia = (raw, index = 0) => {
    const entity = object(raw?.entity, raw?.data, raw)
    const media = object(entity.media, raw?.media, entity)
    const wrapper = object(entity.track_wrapper, media.track_wrapper, raw?.track_wrapper)
    const track = object(wrapper.track, media.track_entity, raw?.track_entity, media.track, raw?.track, media)
    const base = object(track.base_info, media.base_info, raw?.base_info, track)
    const display = object(track.display_info, media.display_info, raw?.display_info)
    const related = object(track.related_info, media.related_info, raw?.related_info)
    const album = object(raw?.album_info, raw?.album, related.album_link, base.album, track.album)
    const id = text(base.id || track.id || media.id || raw?.item_id || raw?.song_id || raw?.music_id)
    const name = text(base.name || base.title || track.name || track.title || media.name || raw?.title || raw?.name)
    if (!id || !name) return null
    const artist = artistText(
        raw?.author_info, raw?.author, raw?.authors, raw?.artist, raw?.artists, raw?.singer, raw?.singers,
        related.artist_links, related.artist, related.artists,
        base.author, base.authors, base.artist, base.artists, base.singer, base.singers,
        track.author, track.authors, track.artist, track.artists, track.singer, track.singers,
        raw?.author_name, raw?.artist_name,
    ) || '未知歌手'
    return {
        id,
        name,
        artist,
        album: text(album.name || album.title || raw?.album_name || base.album_name),
        pic: firstUrl(
            display.cover_url || display.url_cover || display.cover ||
            base.cover_url || base.url_cover || base.cover ||
            track.cover_url || track.url_cover || track.cover ||
            raw?.cover_url || raw?.url_cover || raw?.cover ||
            album.cover_url || album.url_cover || album.cover,
        ),
        duration: seconds(base.duration_ms || base.duration || track.duration_ms || track.duration || raw?.duration_ms || raw?.duration),
        url: id,
        lrc: id,
        source: 'qishui',
        _rank: index,
    }
}

const publicSearch = async (keyword, limit = 30) => {
    const json = await requestJson(urlWithParams(PUBLIC_SEARCH, {
        keyword, search_type: 'music', limit: Math.max(30, limit), real_offset: 0, search_source: 'qishui',
    }))
    return array(json?.data?.list).map(mapMedia).filter(Boolean).slice(0, limit)
}

const pcSearch = async (keyword, cookie, limit = 30) => {
    const json = await requestJson(urlWithParams(`${PC_API}/luna/pc/search/track`, pcParams({
        q: keyword, cursor: '0', count: Math.min(50, limit), search_method: 'input',
    })), { cookie })
    return collectMedia(json).map(mapMedia).filter(Boolean).slice(0, limit)
}

const get_search_songs = async (keyword, cookie) => {
    if (qishuiCookieHasLogin(cookie)) {
        try { return await pcSearch(keyword, cookie) } catch (error) {
            // PC 搜索接口偶尔返回 200 空正文，直接使用公开搜索避免误报登录失败。
            if (!/空响应/.test(String(error?.message || ''))) {
                console.warn('[Qishui] 登录搜索回退:', error.message)
            }
        }
    }
    return publicSearch(keyword)
}

const collectPlaylists = (payload) => {
    const playlists = []
    const seen = new Set()
    const visit = (node, depth = 0) => {
        if (!node || depth > 8) return
        if (Array.isArray(node)) {
            node.slice(0, 200).forEach(item => visit(item, depth + 1))
            return
        }
        if (typeof node !== 'object') return
        const playlist = object(node.playlist, node.entity?.playlist)
        const id = text(playlist.id || playlist.playlist_id)
        if (id && !seen.has(id)) {
            seen.add(id)
            playlists.push({
                id,
                name: text(playlist.name || playlist.title) || '未命名歌单',
                cover: firstUrl(playlist.cover_url || playlist.cover || playlist.url_cover || playlist.coverURL),
                creator: text(playlist.creator_name || playlist.creator?.nickname || playlist.creator?.name),
                trackCount: Number(playlist.track_count || playlist.count_tracks || playlist.song_count || 0) || 0,
                playCount: Number(playlist.play_count || playlist.playcount || 0) || 0,
            })
        }
        Object.values(node).slice(0, 200).forEach(item => visit(item, depth + 1))
    }
    visit(payload)
    return playlists
}

const get_search_playlists = async (keyword, cookie) => {
    if (!text(keyword)) return []
    const params = pcParams({ q: text(keyword), cursor: '0', search_method: 'input', search_scene: '' })
    try {
        const json = await requestJson(urlWithParams(`${PC_API}/luna/pc/search/playlist`, params), { cookie })
        const playlists = collectPlaylists(json)
        if (playlists.length) return playlists
    } catch (error) { console.warn('[Qishui] 歌单搜索回退:', error.message) }
    try {
        const json = await requestJson(urlWithParams(`${PC_API}/luna/pc/search/mixed`, params), { cookie })
        return collectPlaylists(json)
    } catch (error) { console.warn('[Qishui] 混合搜索歌单失败:', error.message); return [] }
}

const get_playlist = async (id, cookie) => {
    if (!text(id) || !qishuiCookieHasLogin(cookie)) return []
    const params = pcParams({
        version_name: '3.6.0',
        version_code: '30060000',
        playlist_id: text(id),
        cursor: '',
        count: '100',
    })
    try {
        const json = await requestJson(
            urlWithParams(`${PC_API}/luna/pc/playlist/detail`, params),
            {
                cookie,
                timeout: 15000,
                headers: { 'User-Agent': PLAYLIST_WEB_UA },
            },
        )
        return collectMedia(json).map(mapMedia).filter(Boolean)
    } catch (error) {
        console.warn('[Qishui] 歌单详情获取失败:', error.message)
        return []
    }
}

const getPublicDetail = async (id) => {
    const json = await requestJson(urlWithParams(PUBLIC_DETAIL, {
        sources: 'qishui', need_author: true, need_album: true, need_ugc: true, need_stat: true, item_ids: id,
    }))
    return array(json?.data?.list)[0] || null
}

const getSeoTrackDetail = async (id, cookie) => requestJson(urlWithParams(`${LUNA_API}/luna/h5/seo_track`, {
    ...mediaPlayerAndroidParams(),
    track_id: id,
    device_platform: 'web',
}), { cookie, timeout: 12000, headers: { 'User-Agent': LUNA_ANDROID_UA } })

const get_song_info = async (id, cookie) => {
    try {
        const json = await getSeoTrackDetail(id, cookie)
        const item = mapMedia(json?.seo_track?.track)
        if (item) return [item]
    } catch {}
    const item = mapMedia(await getPublicDetail(id))
    return item ? [item] : []
}

const normalizeLyric = (input) => text(input).replace(/\\n/g, '\n').split('\n').map(line => {
    const match = /^\[(\d+),(\d+)\](.*)$/.exec(line.trim())
    if (!match) return line
    const time = Number(match[1]) || 0
    const minutes = Math.floor(time / 60000)
    const secondsValue = ((time % 60000) / 1000).toFixed(3).padStart(6, '0')
    const body = match[3].replace(/<\d+,\d+,\d+>/g, '')
    return `[${String(minutes).padStart(2, '0')}:${secondsValue}]${body}`
}).join('\n')

const lyricText = (node) => {
    if (typeof node === 'string' && node.includes('[')) return normalizeLyric(node)
    if (!node || typeof node !== 'object') return ''
    return lyricText(node.content || node.lyric_text || node.lyric || node.text || node.entity)
}

const findLyrics = (payload) => {
    let lyric = ''
    let tlyric = ''
    const seen = new Set()
    const visit = (node, path = '', depth = 0) => {
        if (!node || depth > 7 || seen.has(node) || (lyric && tlyric)) return
        if (typeof node !== 'object') return
        seen.add(node)
        Object.entries(node).slice(0, 120).forEach(([key, value]) => {
            const next = `${path}.${key}`
            if (/lyric|translation|tlyric/i.test(key)) {
                const valueText = lyricText(value)
                if (/translation|tlyric|translated/i.test(next)) tlyric ||= valueText
                else lyric ||= valueText
            }
            visit(value, next, depth + 1)
        })
    }
    visit(payload)
    return { lyric, tlyric }
}

const get_lyric = async (id, cookie) => {
    try {
        return findLyrics(await getSeoTrackDetail(id, cookie))
    } catch {
        const detail = await getPublicDetail(id)
        return findLyrics(detail || {})
    }
}

const streamUrl = (value) => firstUrl(
    value?.main_play_url || value?.MainPlayUrl || value?.main_url || value?.url || value?.URL ||
    value?.play_url || value?.PlayURL || value?.backup_play_url || value?.backup_urls,
)

const streamFrom = (value, inherited = {}) => {
    if (!value || typeof value !== 'object') return null
    const url = streamUrl(value)
    if (!url) return null
    const meta = object(value.video_meta, value.VideoMeta, value.meta)
    const bitrate = Number(value.bitrate || value.Bitrate || value.real_bitrate || value.br || meta.bitrate || 0)
    const quality = text(value.quality || value.Quality || value.definition || meta.quality || value.gear_des_key || inherited.quality)
    const format = text(value.format || value.Format || value.vtype || meta.format || meta.vtype)
    const codecType = text(value.codec_type || value.codecType || meta.codec_type || meta.codecType)
    const authInfo = object(value.encrypt_info, value.EncryptInfo, value.encryptInfo)
    const auth = text(value.play_auth || value.PlayAuth || value.spade_a || authInfo.spade_a || inherited.auth)
    const audioCodec = /(?:aac|flac|mp3|m4a|opus|audio)/i.test(`${format} ${codecType}`)
    let isVideo = /video/i.test(format) && !audioCodec
    let mimeType = ''
    try {
        mimeType = text(new URL(url).searchParams.get('mime_type'))
        isVideo ||= /(?:^|_)video_/i.test(mimeType) && !audioCodec
    } catch {}
    const isMp4 = /(?:^|[._/-])mp4(?:$|[._/?-])/i.test(`${format} ${mimeType} ${url}`)
    return { url, auth, bitrate, quality, format, mimeType, isVideo, isMp4, duration: seconds(value.duration || inherited.duration) }
}

const collectStreams = (payload) => {
    const streams = []
    const seen = new Set()
    const visit = (node, inherited = {}, depth = 0) => {
        if (!node || depth > 8) return
        if (typeof node === 'string') {
            const value = node.trim()
            if ((value.startsWith('{') || value.startsWith('[')) && value.length < 2_000_000) {
                try { visit(JSON.parse(value), inherited, depth + 1) } catch {}
            }
            return
        }
        if (typeof node !== 'object' || seen.has(node)) return
        seen.add(node)
        if (Array.isArray(node)) {
            node.slice(0, 250).forEach(item => visit(item, inherited, depth + 1))
            return
        }
        const authInfo = object(node.encrypt_info, node.EncryptInfo, node.encryptInfo)
        const next = {
            auth: text(node.play_auth || node.PlayAuth || node.spade_a || authInfo.spade_a || inherited.auth),
            duration: seconds(node.duration || node.video_duration || inherited.duration),
            quality: text(node.quality || node.definition || node.gear_des_key || inherited.quality),
        }
        const stream = streamFrom(node, next)
        if (stream) streams.push(stream)
        Object.values(node).slice(0, 250).forEach(item => visit(item, next, depth + 1))
    }
    visit(payload)
    return streams.filter((item, index, list) => list.findIndex(other => other.url === item.url) === index)
}

const qualityRank = (stream) => {
    const label = `${stream.quality} ${stream.format}`.toLowerCase()
    const bitrate = stream.bitrate > 10000 ? stream.bitrate / 1000 : stream.bitrate
    if (/studio|recording|录音室|spatial/.test(label)) return 130
    if (/atmos|dolby|全景|hi[_-]?res/.test(label)) return 120
    if (/lossless|flac|sq|highest/.test(label) || bitrate >= 900) return 100
    if (/highest|excellent|superhigh|hq/.test(label)) return 80
    if (/higher|high|320/.test(label) || bitrate >= 320) return 70
    return 50
}

const requestedRank = (quality) => {
    if (/studio|recording/.test(quality)) return 130
    if (/atmos|dolby|spatial/.test(quality)) return 120
    if (/hi[_-]?res|master/.test(quality)) return 120
    if (/flac|lossless/.test(quality)) return 100
    if (/320|exhigh|higher/.test(quality)) return 70
    return 50
}

const selectSongStream = (streams, options = {}) => {
    const audioStreams = streams.filter(stream => !stream.isVideo)
    // 某些汽水歌曲只有 video_mp4，但其中包含可由浏览器音频元素解码的音轨。
    // 优先正常音频流；没有音频流时仅允许 MP4 回退，避免把 webm 等纯视频误当音频。
    const playableStreams = (audioStreams.length ? audioStreams : streams.filter(stream => stream.isMp4))
        .sort((a, b) => qualityRank(b) - qualityRank(a))
    if (!playableStreams.length) return null

    const target = requestedRank(text(options.quality).toLowerCase())
    const selected = playableStreams.find(stream => qualityRank(stream) <= target)
        || playableStreams[playableStreams.length - 1]
    const selectedRank = qualityRank(selected)
    const level = selectedRank >= 130 ? 'studio'
        : selectedRank >= 120 ? 'atmos'
            : selectedRank >= 100 ? 'lossless'
                : selectedRank >= 70 ? 'exhigh' : 'standard'
    return {
        url: selected.url,
        auth: selected.auth,
        mimeType: selected.mimeType || undefined,
        quality: level,
        duration: selected.duration ? selected.duration * 1000 : undefined,
    }
}

const get_pc_song_url = async (id, cookie, options = {}) => {
    const queueType = text(options.queueType) || 'favorite_track_playlist'
    const sceneName = text(options.sceneName) || 'library'
    const url = urlWithParams(`${PC_API}/luna/pc/track_v2`, streamPcParams(), { includeEmpty: true })
    const body = {
        track_id: id,
        media_type: 'track',
        queue_type: queueType,
        scene_name: sceneName,
    }
    const json = await requestJson(url, {
        cookie,
        method: 'POST',
        body,
        signatureDeviceId: PC_DEVICE_ID,
        signatureUrl: options.signerUrl,
        headers: {
            'User-Agent': STREAM_WEB_UA,
        },
        timeout: 12000,
        debugRaw: true,
        debugLabel: 'track_v2',
    })
    console.log('[Qishui] track_v2 平台响应', JSON.stringify({
        id: text(id),
        requestedQuality: text(options.quality) || 'standard',
        queueType,
        sceneName,
        statusCode: json?.status_code,
        statusMessage: json?.status_info?.status_msg,
        riskResult: json?.risk_result,
        hasTrackPlayer: Boolean(json?.track_player),
        hasVideoModel: Boolean(json?.track_player?.video_model),
    }))
    const stream = selectSongStream(collectStreams(json), options)
    const loudness = mapQishuiLoudness(json)
    return loudness && stream ? { ...stream, loudness } : stream
}
const get_media_player_song_url = async (id, cookie, options = {}) => {
    const json = await requestJson(urlWithParams(`${LUNA_API}/luna/media-player`, mediaPlayerAndroidParams(), { includeEmpty: true }), {
        cookie,
        method: 'POST',
        body: {
            media_id: id,
            media_type: 'track',
            queue_type: '',
            enable_refresh_api: false,
            enable_dash: true,
        },
        headers: {
            'User-Agent': LUNA_ANDROID_UA,
        },
        timeout: 12000,
        debugRaw: true,
        debugLabel: 'media-player',
    })
    console.log('[Qishui] media-player 平台响应', JSON.stringify({
        id: text(id),
        requestedQuality: text(options.quality) || 'standard',
        playerInfos: array(json?.player_infos, json?.playerInfos).length,
        hasUrlPlayerInfo: Boolean(object(json?.player_infos?.[0], json?.playerInfos?.[0]).url_player_info),
        hasVideoModel: Boolean(object(json?.player_infos?.[0], json?.playerInfos?.[0]).video_model),
    }))
    const stream = selectSongStream(collectStreams(json), options)
    const loudness = mapQishuiLoudness(json)
    return loudness && stream ? { ...stream, loudness } : stream
}

const get_song_url = async (id, cookie, options = {}) => {
    // 汽水取链需要 X-Medusa、X-Helios，使用手机端接口替代。
    if (!text(cookie) || !isQishuiRemoteSignerConfigured(options.signerUrl)) return null
    try {
        return await get_pc_song_url(id, cookie, options)
    } catch (error) {
        console.warn('[Qishui] 获取播放流失败', JSON.stringify({
            id: text(id),
            requestedQuality: text(options.quality) || 'standard',
            error: error?.message || String(error),
        }))
        return null
    }
}

const buildFeedPreference = (mode) => {
    const raw = text(mode)
    const upper = raw.toUpperCase()

    // DEFAULT 是汽水自己的“推荐”模式。不要人为塞入 scene_mode_id，
    // 让 PC 接口按默认推荐上下文返回；后续取流仍使用 daily_mix/track_reco。
    if (!raw || upper === 'DEFAULT') return {}

    // 场景模式仍使用数字 scene_mode_id；同时兼容显式的 scene_mode_id:6 写法。
    const sceneMatch = /^(?:SCENE_MODE_ID[:_])?(\d+)$/.exec(raw)
    const sceneModeId = sceneMatch ? Number(sceneMatch[1]) : 0
    if (Number.isInteger(sceneModeId) && sceneModeId > 0) {
        return { scene_mode_id: sceneModeId }
    }

    // song-tab 的熟悉/新鲜等模式使用 preference_mode。未知字符串先透传，
    // 等拿到对应抓包值后再补别名，避免把它误当成场景数字。
    const preferenceMode = raw.replace(/^PREFERENCE_MODE[:_]/i, '').trim().toLowerCase()
    return /^[a-z][a-z0-9_-]*$/.test(preferenceMode)
        ? { preference_mode: preferenceMode }
        : {}
}

const get_personal_fm = async (mode, cookie) => {
    if (!qishuiCookieHasLogin(cookie)) {
        throw Object.assign(new Error('Cookie 缺少汽水登录态'), { code: 'MUSIC_ACCOUNT_INVALID' })
    }

    // PC 客户端漫游使用 feed/song-tab，一次返回一批推荐歌曲；不再调用
    // 移动端发现页或电台接口。DEFAULT 由 PC 接口提供默认推荐，
    // 熟悉/新鲜模式走 preference_mode，场景模式走 scene_mode_id。
    const feedPreference = buildFeedPreference(mode)
    const isDefaultMode = !text(mode) || text(mode).toUpperCase() === 'DEFAULT'
    const sessionKey = feedSessionKey(cookie, mode)
    const session = feedSessions.get(sessionKey) || {
        didFirstUseTime: Math.floor(Date.now() / 1000),
        isFirstRequest: true,
        playedMedia: [],
    }
    try {
        const json = await requestJson(
            urlWithParams(`${PC_API}/luna/pc/feed/song-tab`, pcParams()),
            {
                cookie,
                method: 'POST',
                body: {
                    feed_counts: { mix_session_count: 1 },
                    // 该字段表示客户端是否完成过汽水首次引导，不等同于本次请求次数。
                    // 抓包显示漫游会话中持续为 false。
                    is_did_first_request: false,
                    is_first_request: session.isFirstRequest,
                    played_media: session.playedMedia,
                    ...(isDefaultMode
                        ? { did_first_use_time: session.didFirstUseTime }
                        : { feed_preference: feedPreference }),
                },
                timeout: 12000,
            },
        )
        const songs = collectMedia(json).map(mapMedia).filter(Boolean)
        console.log('[Qishui song-tab] 歌曲名称:', songs.map(song => song.name || song.title || '').filter(Boolean).join(' | '))
        // 接口没有回传“已播放”确认事件，只记录本会话已下发过的歌曲，避免连续请求重复推荐。
        const nextPlayed = [
            ...session.playedMedia,
            ...songs.map(song => ({
                duration: Number(song.duration) > 0
                    ? (Number(song.duration) > 10000 ? Number(song.duration) : Number(song.duration) * 1000)
                    : 0,
                media_id: String(song.id),
                played_mills: -1,
                type: 'track',
            })).filter(item => item.media_id),
        ]
        session.isFirstRequest = false
        const uniquePlayed = new Map()
        nextPlayed.forEach(item => uniquePlayed.set(item.media_id, item))
        session.playedMedia = [...uniquePlayed.values()].slice(-FEED_SESSION_LIMIT)
        feedSessions.set(sessionKey, session)
        if (feedSessions.size > 200) {
            const oldest = feedSessions.keys().next().value
            if (oldest) feedSessions.delete(oldest)
        }
        return songs
    } catch (error) {
        throw error
    }
}

const normalizeMembershipKey = (value) => text(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')

const membershipPositive = (value) => {
    if (value === true) return true
    if (typeof value === 'number') return Number.isFinite(value) && value > 0
    const valueText = text(value).toLowerCase()
    return /^(true|yes|active|valid|enabled|opened|vip|svip|premium|member|会员|已开通|有效)$/.test(valueText)
}

const membershipLevel = (value) => {
    const valueText = text(value).toLowerCase().replace(/[\s_-]+/g, '')
    if (/^(svip|supervip|超级会员|超级vip|豪华会员)$/.test(valueText)) return 'svip'
    if (/^(vip|premium|member|会员|普通会员)$/.test(valueText)) return 'vip'
    return ''
}

const vipMembershipContainers = new Set([
    'vipinfo', 'vipdetail', 'vipbenefit', 'vippackage', 'memberinfo', 'memberdetail',
    'memberbenefit', 'memberpackage', 'membershipinfo', 'membershipdetail',
])

const svipMembershipContainers = new Set([
    'svipinfo', 'svipdetail', 'svipbenefit', 'svippackage', 'supervipinfo',
    'supervipdetail', 'supervipbenefit', 'supervippackage',
])

const membershipContainerActive = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return membershipPositive(value)
    let positive = false
    let hasExpiry = false
    let futureExpiry = false
    for (const [key, item] of Object.entries(value)) {
        const normalized = normalizeMembershipKey(key)
        if (['status', 'state', 'active', 'valid', 'enabled', 'isactive', 'isvalid', 'isenabled', 'isopen', 'opened'].includes(normalized)) {
            if (membershipPositive(item)) positive = true
        }
        if (/^(expiretime|expiresat|expirationtime|expiredat|endtime|validuntil)$/.test(normalized)) {
            const number = Number(item)
            const expiry = Number.isFinite(number) && number > 0
                ? (number < 100000000000 ? number * 1000 : number)
                : Date.parse(String(item || ''))
            hasExpiry = true
            if (expiry > Date.now()) futureExpiry = true
        }
    }
    return hasExpiry ? futureExpiry : positive
}

// 只读取明确的会员字段，不能把 svip_expire_time 等升级/过期字段当成 SVIP。
export const parseQishuiMembership = (payload) => {
    const vipNumberKeys = new Set(['viptype', 'viplevel', 'membertype', 'memberlevel', 'musicviptype', 'musicviplevel'])
    const svipNumberKeys = new Set(['sviptype', 'sviplevel', 'superviptype', 'superviplevel'])
    const vipFlagKeys = new Set(['isvip', 'ismember', 'hasvip', 'hasmembership', 'vipactive', 'vipenabled'])
    const svipFlagKeys = new Set(['issvip', 'issupervip', 'hassvip', 'hassupervip', 'svipactive', 'svipenabled'])
    const labelKeys = new Set([
        'viplevelname', 'vipname', 'vipstage',
        'memberlevelname', 'membername', 'membershiplevel', 'membershiptype',
    ])
    let known = false
    let isVip = false
    let isSvip = false
    let visited = 0
    const visit = (node, depth) => {
        if (!node || typeof node !== 'object' || depth > 6 || visited > 600) return
        visited += 1
        if (Array.isArray(node)) {
            node.slice(0, 120).forEach((item) => visit(item, depth + 1))
            return
        }
        for (const [key, value] of Object.entries(node).slice(0, 180)) {
            const normalized = normalizeMembershipKey(key)
            if (svipNumberKeys.has(normalized)) {
                known = true
                if (Number(value) > 0) isSvip = true
            } else if (vipNumberKeys.has(normalized)) {
                known = true
                if (Number(value) > 0) isVip = true
            } else if (svipFlagKeys.has(normalized)) {
                known = true
                if (membershipPositive(value)) isSvip = true
            } else if (vipFlagKeys.has(normalized)) {
                known = true
                if (membershipPositive(value)) isVip = true
            } else if (labelKeys.has(normalized)) {
                known = true
                const level = membershipLevel(value)
                if (level === 'svip') isSvip = true
                else if (level === 'vip') isVip = true
            } else if (svipMembershipContainers.has(normalized)) {
                known = true
                if (membershipContainerActive(value)) isSvip = true
            } else if (vipMembershipContainers.has(normalized)) {
                known = true
                if (membershipContainerActive(value)) isVip = true
            }
            if (value && typeof value === 'object') visit(value, depth + 1)
        }
    }
    visit(payload, 0)
    if (isSvip) isVip = true
    return { known, isVip, isSvip }
}

const support_type = ['url', 'lrc', 'song', 'pic', 'search', 'playlist', 'search_playlist', 'fm']

const handle = async (type, id, cookie = '', options = {}) => {
    if (type === 'search') return get_search_songs(id, cookie)
    if (type === 'song') return get_song_info(id, cookie)
    if (type === 'pic') return (await get_song_info(id, cookie))[0]?.pic || ''
    if (type === 'lrc') return get_lyric(id, cookie)
    if (type === 'url') return get_song_url(id, cookie, options)
    if (type === 'playlist') return get_playlist(id, cookie)
    if (type === 'search_playlist') return get_search_playlists(id, cookie)
    if (type === 'fm') return get_personal_fm(id, cookie)
    return -1
}

export const getQishuiProfile = async (cookie) => {
    if (!qishuiCookieHasLogin(cookie)) return { valid: false, error: 'Cookie 缺少汽水登录态', userInfo: null }
    try {
        const json = await requestJson(urlWithParams(`${PC_API}/luna/pc/me`, pcParams()), {
            cookie,
            timeout: 8000,
            headers: {
                'Cache-Control': 'no-cache, no-store',
                Pragma: 'no-cache',
            },
        })
        // 不同版本的 PC 接口有时把 my_info 放在 data 内，有时直接放在顶层。
        // 两层都保留检查，避免外层 data 被选中后丢掉顶层会员信息。
        const root = json?.data || json || {}
        const user = object(
            root.my_info, root.myInfo, root.user, root.user_info, root.account, root.me,
            json?.my_info, json?.myInfo, json?.user, json?.user_info,
            root,
        )
        const membership = parseQishuiMembership(json)
        // 汽水 PC 接口的正式会员等级位于 my_info.vip_stage；该字段优先于 is_vip。
        // 这样普通 VIP 标记不会把 SVIP 账号降级成 VIP。
        const vipStage = text(user.vip_stage || user.vipStage).toLowerCase().replace(/[\s_-]+/g, '')
        const explicitSvip = vipStage === 'svip' || vipStage === 'supervip' || vipStage === '超级会员'
        // 仅使用 PC 会员接口中明确的汽水会员字段；普通 VIP 不会被当作 SVIP。
        const isVip = membership.isVip || membership.isSvip || explicitSvip
        const isSvip = explicitSvip || membership.isSvip
        return {
            valid: true,
            error: null,
            userInfo: {
                userId: text(user.id || user.user_id || user.uid),
                nickname: text(user.nickname || user.nick_name || user.name || user.douyin_id || '汽水用户'),
                avatarUrl: firstUrl(user.avatar_url || user.avatar || user.larger_avatar_url),
                isVip,
                isSvip,
                vipStage: vipStage || '',
                vipType: isSvip ? 2 : isVip ? 1 : 0,
                canPlayVip: isVip || isSvip,
                canPlaySvip: isSvip,
                membershipKnown: membership.known,
            },
        }
    } catch (error) {
        return { valid: false, error: `汽水 Cookie 验证失败: ${error.message}`, userInfo: null }
    }
}

export default {
    register: (ctx) => ctx.register('qishui', { handle, support_type }),
}
