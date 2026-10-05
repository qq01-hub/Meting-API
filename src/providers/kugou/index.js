import { createHash, randomUUID } from 'node:crypto'

const LITE_APPID = 3116
const LITE_CLIENTVER = 11440
const SIGN_SALT = 'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA'
const TRACK_KEY_SALT = '185672dd44712f60bb1736df5a377e82'
const API_BASE = 'https://gateway.kugou.com'
const LYRIC_BASE = 'https://lyrics.kugou.com'
const MID = '0'
const SHARE_APPID = 1001
const SHARE_CLIENTVER = 20141
const SHARE_SIGN_SALT = 'OIlwieks28dk2k092lksi2UIkp'
const SHARE_COMMAND_URL = 'http://t.kugou.com/command/'
const H5_SIGN_SALT = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt'

const text = (value) => String(value ?? '').trim()
const md5 = (value) => createHash('md5').update(String(value)).digest('hex')

export const isKugouShareCode = (value = '') => /^\d{8,20}$/.test(text(value))

export const buildKugouShareKey = (data, appid = SHARE_APPID, clientver = SHARE_CLIENTVER) =>
  md5(String(appid) + SHARE_SIGN_SALT + String(clientver) + text(data))

export const buildKugouShareRequest = (code, {
  mid = MID,
  clienttime = Math.floor(Date.now() / 1000),
  clienttimems = Date.now(),
  deviceId = '',
} = {}) => {
  const data = text(code)
  const body = {
    appid: SHARE_APPID,
    clientver: SHARE_CLIENTVER,
    mid: text(mid) || MID,
    clienttime,
    key: buildKugouShareKey(data),
    data,
  }
  return {
    url: SHARE_COMMAND_URL,
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'KG-CLIENTTIMEMS': String(clienttimems),
      ...(text(deviceId) ? { 'KG-DEVID': text(deviceId) } : {}),
      'KG-RC': '1',
      'KG-RF': 'FFFFF787',
      'KG-Rec': '1',
      'KG-THash': '5d816a0',
      'User-Agent': 'KuGou2012-20141-NetworkSuperCall',
      'kg-rfb': '0',
    },
    body,
  }
}

export const extractKugouShareCollectionId = (payload = {}) => {
  if (Number(payload.status) !== 1 || Number(payload.err_code) !== 0) return ''
  const info = payload.data?.info || payload.info || {}
  const id = text(info.global_collection_id || info.copy_gcid)
  return /^collection_[A-Za-z0-9_]+$/i.test(id) ? id : ''
}

export const buildKugouSignature = (params, body = '', salt = SIGN_SALT) => {
  const serialized = Object.keys(params).sort().map((key) => {
    const value = params[key]
    return `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`
  }).join('')
  return md5(`${salt}${serialized}${body || ''}${salt}`)
}

export const parseKugouCookie = (raw = '') => Object.fromEntries(text(raw).split(';').map((part) => {
  const index = part.indexOf('=')
  return index > 0 ? [part.slice(0, index).trim(), part.slice(index + 1).trim()] : null
}).filter(Boolean))

export const isKugouMembershipRequestParamError = (error) => [20010, 20017].includes(Number(error?.code || error?.error_code))
export const isKugouNonFatalError = (error) => {
  const code = Number(error?.code || error?.error_code || error?.status)
  return code === 20010 || code === 200101 || code === 31863 || (code >= 500 && code < 600)
}
export const buildKugouTrackKey = (hash, cookie = {}) => md5(`${text(hash).toLowerCase()}${TRACK_KEY_SALT}${LITE_APPID}${buildKugouDevice(cookie).mid}${Number(cookie.userid) || 0}`)
export const normalizeKugouId = (id) => {
  const [hash = '', albumAudioId = '0'] = text(id).split(',')
  return { hash: hash.toLowerCase(), albumAudioId: Number(albumAudioId) || 0 }
}

const imageUrl = (value) => text(value).replace('{size}', '400').replace('{hash}', '').replace('http://', 'https://')

export const mapKugouSong = (song = {}) => {
  const info = song.info || {}
  const transParam = song.trans_param || song.transParam || {}
  const hash = text(song.hash || song.Hash || song.fileHash || song.FileHash).toLowerCase()
  const fileName = text(song.FileName || song.filename || song.file_name)
  const fileTitle = fileName.includes(' - ') ? fileName.slice(fileName.indexOf(' - ') + 3).trim() : fileName
  const audioName = text(song.audio_name || song.audioName || song.name)
  const separator = audioName.indexOf(' - ')
  const audioAuthor = separator > 0 ? audioName.slice(0, separator).trim() : ''
  const audioTitle = separator > 0 ? audioName.slice(separator + 3).trim() : audioName
  const authors = Array.isArray(song.authors || song.singerinfo)
    ? (song.authors || song.singerinfo).map((author) => text(author?.author_name || author?.authorName || author?.name)).filter(Boolean).join(' / ')
    : ''
  const duration = Number(song.duration ?? song.Duration ?? song.timelength ?? song.timelen ?? song.time_length ?? info.duration ?? 0)
  return {
    id: hash,
    title: text(song.songname || song.songName || song.SongName || fileTitle || audioTitle),
    author: text(song.singername || song.singerName || song.SingerName || song.author_name || song.author || authors || audioAuthor),
    album: text(song.album_name || song.albumName || song.AlbumName || song.album || song.albumname || song.albuminfo?.name),
    pic: imageUrl(song.img || song.image || song.Image || song.album_img || song.albumImage || song.cover || transParam.union_cover || info.image),
    duration: duration > 10000 ? Math.round(duration / 1000) : duration,
    url: hash,
    lrc: hash,
    source: 'kugou',
  }
}

export const buildKugouDevice = (cookie = {}) => ({
  dfid: text(cookie.dfid || cookie.kg_dfid || '-'),
  mid: text(cookie.KUGOU_API_MID || cookie.mid || cookie.kg_mid || MID),
  uuid: '-',
  appid: LITE_APPID,
  clientver: LITE_CLIENTVER,
})

export const requestKugou = async (path, { params = {}, method = 'GET', body, cookie = {}, base = API_BASE, headers = {}, signed = true } = {}) => {
  const device = buildKugouDevice(cookie)
  const clienttime = Math.floor(Date.now() / 1000)
  const allParams = signed ? { ...device, clienttime, ...params } : { ...params }
  if (signed && cookie.token) allParams.token = cookie.token
  if (signed && cookie.userid) allParams.userid = cookie.userid
  const bodyText = body === undefined ? '' : JSON.stringify(body)
  if (signed) allParams.signature = buildKugouSignature(allParams, bodyText)
  const url = new URL(path, base)
  Object.entries(allParams).forEach(([key, value]) => url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value)))
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
      ...(signed ? { dfid: device.dfid, mid: device.mid, clienttime: String(clienttime) } : {}),
      'x-router': headers['x-router'] || '',
      ...headers,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(text(cookie.__raw) ? { Cookie: cookie.__raw } : {}),
    },
    ...(body !== undefined ? { body: bodyText } : {}),
  })
  if (!response.ok) {
    const error = new Error(`酷狗接口返回 ${response.status}`)
    error.status = response.status
    throw error
  }
  const data = await response.json()
  if (data?.error_code !== undefined && Number(data.error_code) !== 0) {
    const error = new Error(data?.error || data?.msg || data?.data?.errmsg || (typeof data?.data === 'string' ? data.data : '') || '酷狗接口请求失败')
    error.code = Number(data.error_code)
    error.payload = data
    throw error
  }
  return data
}

export const extractKugouSongs = (data) => {
  const list = Array.isArray(data?.data)
    ? data.data
    : data?.data?.info || data?.data?.lists || data?.data?.songs || data?.data?.songlist || data?.data?.song_list || data?.info || []
  return Array.isArray(list) ? list.map(mapKugouSong).filter((song) => song.id) : []
}

const extractSongs = extractKugouSongs

const search = async (keyword, cookie) => {
  const data = await requestKugou('/song_search_v2', {
    base: 'https://songsearch.kugou.com',
    params: { keyword, page: 1, pagesize: 30, platform: 'WebFilter', filter: 2 },
    cookie,
    signed: false,
  })
  return extractSongs(data)
}

export const mapKugouPlaylist = (item = {}) => ({
  id: text(item.global_collection_id || item.gid || item.specialid || item.id),
  title: text(item.specialname || item.name || item.title),
  author: text(item.nickname || item.username || item.author_name),
  pic: imageUrl(item.img || item.image || item.imgurl),
  url: text(item.global_collection_id || item.gid || item.specialid || item.id),
  trackCount: Number(item.song_count || item.trackCount || 0),
  source: 'kugou',
})

const searchPlaylist = async (keyword, cookie) => {
  const data = await requestKugou('/v1/search/special', {
    params: { keyword, page: 1, pagesize: 30, platform: 'AndroidFilter' }, cookie,
    headers: { 'x-router': 'complexsearch.kugou.com' },
  })
  const list = data?.data?.lists || data?.data?.info || data?.lists || []
  return Array.isArray(list) ? list.map(mapKugouPlaylist).filter((item) => item.id) : []
}

export const buildKugouFmRequest = (cookie = {}, clienttime = Date.now()) => {
  const userid = text(cookie.userid)
  const body = {
    appid: LITE_APPID,
    clienttime,
    mid: text(cookie.KUGOU_API_MID || cookie.mid || cookie.kg_mid || MID),
    action: 'play',
    recommend_source_locked: 0,
    song_pool_id: 0,
    callerid: 0,
    m_type: 1,
    platform: 'ios',
    area_code: 1,
    remain_songcnt: 0,
    clientver: LITE_CLIENTVER,
    is_overplay: 0,
    mode: 'normal',
    fakem: 'ca981cfc583a4c37f28d2d49000013c16a0a',
    key: md5(String(LITE_APPID) + SIGN_SALT + String(LITE_CLIENTVER) + String(clienttime)),
  }
  if (userid) {
    body.userid = userid
    body.kguid = userid
  }
  if (text(cookie.token)) body.token = cookie.token
  if (cookie.vip_type !== undefined && cookie.vip_type !== '') body.vip_type = cookie.vip_type
  return { path: '/v2/personal_recommend', method: 'POST', body, router: 'persnfm.service.kugou.com' }
}

const personalFm = async (cookie) => {
  try {
    const request = buildKugouFmRequest(cookie)
    const data = await requestKugou(request.path, {
      method: request.method,
      body: request.body,
      cookie,
      headers: { 'x-router': request.router },
    })
    return extractSongs(data)
  } catch (error) {
    // Personal FM is an optional Kugou feature; upstream rejection or outage
    // should result in an empty provider response, not a unified API 500.
    if (isKugouNonFatalError(error)) return []
    throw error
  }
}

export const buildKugouSongRequest = (id) => {
  const { hash, albumAudioId } = normalizeKugouId(id)
  return {
    path: '/v1/audio/audio',
    method: 'GET',
    base: 'http://kmr.service.kugou.com',
    params: { data: [{ hash, audio_id: albumAudioId }] },
    headers: { 'x-router': 'kmr.service.kugou.com' },
  }
}

const song = async (id, cookie) => {
  const request = buildKugouSongRequest(id)
  return extractSongs(await requestKugou(request.path, {
    method: request.method, params: request.params, cookie,
    base: request.base, headers: request.headers,
  }))
}

export const extractKugouGcid = (value = '') => {
  let input = text(value)
  if (/^https?:\/\//i.test(input)) {
    const url = new URL(input)
    if (!isKugouShareUrl(url)) return ''
    input = url.pathname.replace(/^\/songlist\//i, '').replace(/\/$/, '')
  }
  const match = input.match(/^(?:gcid_)?([0-9a-y]+z[0-9a-y]+z[0-9a-y]+z[0-9a-y]+[0-9a-f]{2})$/i)
  return match ? match[1] : ''
}

const isKugouShareUrl = (url) => ['http:', 'https:'].includes(url.protocol) &&
  (url.hostname === 'kugou.com' || url.hostname.endsWith('.kugou.com')) && !url.username && !url.password && !url.port

export const decodeKugouGcid = (value = '') => {
  const gcid = extractKugouGcid(value)
  if (!gcid) return ''
  const fields = gcid.slice(0, -2).toLowerCase().split('z')
  return 'collection_' + fields.map((field) => [...field].reduce((number, digit) => number * 35n + BigInt(parseInt(digit, 35)), 0n).toString()).join('_')
}

const resolveKugouPlaylistId = async (value, cookie = {}, redirects = 0) => {
  const input = text(value)
  const decoded = decodeKugouGcid(input)
  if (decoded) return decoded
  if (isKugouShareCode(input)) {
    const request = buildKugouShareRequest(input, {
      mid: cookie.KUGOU_API_MID || cookie.mid || cookie.kg_mid || MID,
      deviceId: cookie.KUGOU_API_DEV || cookie.kg_devid || '',
    })
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(request.body),
    })
    if (!response.ok) throw new Error('酷狗分享码接口返回 ' + response.status)
    const collectionId = extractKugouShareCollectionId(await response.json())
    if (!collectionId) {
      const error = new Error('酷狗分享码解析失败')
      error.code = 20006
      throw error
    }
    return collectionId
  }

  if (!/^https?:\/\//i.test(input)) {
    if (isKugouCollectionId(input) || /^\d+$/.test(input)) return input
    throw new Error('无效的酷狗歌单 ID 或 gcid')
  }
  const url = new URL(input)
  if (!isKugouShareUrl(url)) throw new Error('无效的酷狗分享链接')
  const collectionId = url.searchParams.get('global_collection_id') || url.searchParams.get('global_specialid')
  if (isKugouCollectionId(collectionId)) return collectionId
  const specialId = url.searchParams.get('specialid')
  if (/^[1-9]\d*$/.test(specialId || '')) return specialId
  if (redirects >= 5 || url.pathname.startsWith('/songlist/')) throw new Error('酷狗分享链接未包含有效歌单 ID')
  const response = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } })
  await response.body?.cancel()
  const location = response.headers.get('location')
  if (response.status >= 300 && response.status < 400 && location) {
    return resolveKugouPlaylistId(new URL(location, url).href, cookie, redirects + 1)
  }
  throw new Error('酷狗分享链接未返回歌单重定向')
}

export const buildKugouPlaylistRequest = (id, { page = 1, pagesize = 100, clienttime = Date.now(), mid = md5(randomUUID()) } = {}) => {
  const size = Number(pagesize) > 0 ? Number(pagesize) : 100
  const currentPage = Number(page) > 0 ? Number(page) : 1
  const params = {
    appid: 1058, srcappid: 2919, clientver: 20000, clienttime,
    mid, uuid: mid, dfid: '-', uid: 0, token: '', type: 0, module: 'playlist',
    page: currentPage, pagesize: size,
    ...(isKugouCollectionId(id) ? { global_collection_id: text(id) } : { specialid: text(id) }),
  }
  return {
    base: 'https://pubsongscdn.kugou.com',
    path: '/v2/get_other_list_file',
    signed: false,
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://activity.kugou.com/' },
    params: { ...params, signature: buildKugouSignature(params, '', H5_SIGN_SALT) },
  }
}

export const isKugouCollectionId = (value = '') => /^collection_[A-Za-z0-9_]+$/i.test(text(value))

const playlist = async (id, cookie) => {
  try {
    const resolvedId = await resolveKugouPlaylistId(id, cookie)
    const allSongs = []
    const mid = md5(randomUUID())
    let page = 1
    let total = Infinity
    while (allSongs.length < total) {
      const request = buildKugouPlaylistRequest(resolvedId, { page, mid })
      const data = await requestKugou(request.path, request)
      if (Number(data?.status) !== 1) throw new Error(data?.errmsg || '酷狗歌单接口请求失败')
      const pageSongs = Array.isArray(data?.data?.info) ? data.data.info : []
      total = Number(data?.data?.count || 0)
      if (!pageSongs.length) break
      allSongs.push(...pageSongs)
      page += 1
    }
    return allSongs.map(mapKugouSong).filter((song) => song.id)
  } catch (error) {
    // Kugou returns 20010 for unavailable/private collections and occasionally
    // responds with 5xx when this legacy endpoint is degraded. A provider miss
    // should not turn the unified API request into an internal server error.
    if (isKugouNonFatalError(error)) return []
    throw error
  }
}

const KUGOU_QUALITY_MAP = {
  standard: { request: 128, name: '标准' },
  '128': { request: 128, name: '标准' },
  '320': { request: 320, name: '极高' },
  exhigh: { request: 320, name: '极高' },
  flac: { request: 'flac', name: '无损' },
  lossless: { request: 'flac', name: '无损' },
  hires: { request: 'high', name: 'Hi-Res音质' },
  atmos: { request: 'viper_atmos', name: '蝰蛇全景声2.0' },
  master: { request: 'super', name: '母带' },
  viper_atmos: { request: 'viper_atmos', name: '蝰蛇全景声2.0' },
  viper_tape: { request: 'viper_tape', name: '蝰蛇母带音质' },
  viper_clear: { request: 'viper_clear', name: '蝰蛇超清音质' },
  viper_hifi: { request: 'viper_hifi', name: '蝰蛇HiFi音质' },
  acappella: { request: 'acappella', name: '人声伴奏' },
  multitrack: { request: 'multitrack', name: '多轨音质' },
}

export const getKugouQuality = (quality = 'standard') => KUGOU_QUALITY_MAP[String(quality).toLowerCase()] || KUGOU_QUALITY_MAP.standard

export const mapKugouLoudness = (info = {}) => {
  const gain = Number(info.volume)
  const peak = Number(info.volume_peak)
  const loudness = {}
  if (Number.isFinite(gain)) loudness.gain = gain
  if (Number.isFinite(peak)) loudness.peak = peak
  return Object.keys(loudness).length ? loudness : undefined
}

export const getKugouActualQuality = (info = {}) => {
  const responseQuality = text(info.quality || info.quality_name).toLowerCase()
  const explicit = KUGOU_QUALITY_MAP[responseQuality]
  if (explicit && !['super', 'high', 'flac', '320', '128'].includes(responseQuality)) return explicit

  const bitrate = Number(info.bitRate ?? info.bitrate ?? info.bit_rate ?? 0)
  const kbps = bitrate > 10_000 ? bitrate / 1000 : bitrate
  const extension = text(info.extName || info.extname || info.ext || '').toLowerCase()
  if (extension || bitrate > 0) {
    if (extension === 'flac' || kbps >= 700) return KUGOU_QUALITY_MAP.flac
    if (kbps >= 280) return KUGOU_QUALITY_MAP['320']
    return KUGOU_QUALITY_MAP.standard
  }

  return KUGOU_QUALITY_MAP.standard
}

const positive = (value) => value === true || Number(value) > 0 || ['true', 'yes', 'vip'].includes(String(value || '').toLowerCase())
const svip = (value) => value === true || Number(value) > 0 || ['true', 'yes', 'svip', 'super_vip', 'supervip'].includes(String(value || '').toLowerCase())

export const mapKugouMembership = (payload = {}, cookie = {}) => {
  const data = payload?.data?.data || payload?.data || payload || {}
  const vipType = Number(data.vip_type ?? data.vipType ?? data.type ?? cookie.vip_type ?? 0) || 0
  const isSvip = [
    data.is_svip, data.isSvip, data.svip, data.super_vip, data.superVip,
    data.is_super_vip, data.isSuperVip,
  ].some(svip) || ['svip', 'super_vip', 'supervip'].includes(String(data.product_type ?? data.productType ?? data.vip_name ?? data.vipName ?? '').toLowerCase())
  const isVip = isSvip || [data.is_vip, data.isVip, data.vip, data.vip_status, data.vipStatus].some(positive) || vipType > 0
  return { vipType, isVip, isSvip, canPlayVip: isVip, canPlaySvip: isSvip }
}
const audioUrl = async (id, quality, cookie) => {
  const { hash, albumAudioId } = normalizeKugouId(id)
  const requested = getKugouQuality(quality)
  let data
  try {
    data = await requestKugou('/v5/url', {
      params: {
        album_id: 0, area_code: 1, hash, ssa_flag: 'is_fromtrack', version: 11430,
        page_id: 967177915, quality: requested.request, album_audio_id: albumAudioId,
        behavior: 'play', pid: 411, cmd: 26, pidversion: 3001, cdnBackup: 1,
        IsFreePart: 1, ppage_id: '356753938,823673182,967485191', module: '',
        key: buildKugouTrackKey(hash, cookie),
      },
      cookie, headers: { 'x-router': 'trackercdn.kugou.com' },
    })
  } catch (error) {
    if (isKugouNonFatalError(error)) return { url: '', reason: text(error.message || '该曲目当前无可播放地址') }
    throw error
  }
  const info = data?.data || data
  const url = [info?.play_url, info?.url, info?.ori_url, info?.backupUrl, info?.backup_url].flat().find(Boolean) || ''
  const actual = getKugouActualQuality(info)
  return {
    url, quality: actual.name,
    duration: Number(info?.timeLength || info?.duration || 0) || undefined,
    loudness: mapKugouLoudness(info),
    pic: imageUrl(info?.trans_param?.union_cover || info?.img || info?.image),
    ...(url ? {} : { reason: text(info?.fail_process?.join(' / ') || info?.error_msg || '该曲目当前无可播放地址') }),
  }
}
const lyric = async (id, cookie) => {
  const { hash } = normalizeKugouId(id)
  const searchData = await requestKugou('/search', {
    base: LYRIC_BASE, params: { ver: 1, man: 'yes', client: 'pc', hash }, cookie, signed: false,
  })
  const item = searchData?.candidates?.[0]
  if (!item?.id || !item?.accesskey) return { lyric: '' }
  const result = await requestKugou('/download', {
    base: LYRIC_BASE, params: { ver: 1, client: 'pc', id: item.id, accesskey: item.accesskey, fmt: 'lrc', charset: 'utf8' }, cookie, signed: false,
  })
  const content = result?.content || ''
  return { lyric: content ? Buffer.from(content, 'base64').toString('utf8') : '' }
}

const handle = async (type, id, rawCookie = '', options = {}) => {
  const cookie = { ...parseKugouCookie(rawCookie), __raw: rawCookie }
  if (type === 'search') return search(id, cookie)
  if (type === 'song') return song(id, cookie)
  if (type === 'playlist') return playlist(id, cookie)
  if (type === 'search_playlist') return searchPlaylist(id, cookie)
  if (type === 'url') return audioUrl(id, options.quality || 'standard', cookie)
  if (type === 'lrc') return lyric(id, cookie)
  if (type === 'pic') return (await audioUrl(id, 'standard', cookie)).pic || ''
  if (type === 'fm') return personalFm(cookie)
  return []
}

const support_type = ['url', 'pic', 'lrc', 'song', 'playlist', 'search', 'search_playlist', 'fm']

export default { register: (ctx) => ctx.register('kugou', { handle, support_type }) }
