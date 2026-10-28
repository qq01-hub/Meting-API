/**
 * 网易云电台 / 播客
 *
 * | type        | id           | 说明                         |
 * |-------------|--------------|------------------------------|
 * | dj          | 电台 ID      | 电台下节目列表（可播放）     |
 * | dj_detail   | 电台 ID      | 电台详情                     |
 * | djprogram   | 节目 ID      | 单集详情（可播放）           |
 * | dj_hot      | hot/recommend| 热门电台 / 推荐电台          |
 * | search_dj   | 关键词       | 电台搜索                     |
 */
import { request } from './util.js'

const PROGRAM_URL = 'https://music.163.com/weapi/dj/program/byradio'
const RATE_LIMIT_RETRIES = 2
const RATE_LIMIT_CODES = new Set([455])
const RATE_LIMIT_PATTERN = /操作频繁|访问太频繁|请求频繁|too many|rate limit|频率/i

/** 逐页加载时的页间隔；限频重试间隔按倍数递增。测试可置 0 */
const djPageDelay = () => {
    const configured = Number(process.env.NETEASE_DJ_PAGE_DELAY_MS)
    return Number.isFinite(configured) && configured >= 0 ? configured : 400
}

const delay = (ms) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve())

const messageOf = (res) => String(res?.message || res?.msg || '')

const isRateLimited = (res) => RATE_LIMIT_PATTERN.test(messageOf(res)) || RATE_LIMIT_CODES.has(Number(res?.code))

/** 单页请求：遇到「操作频繁」类限频时退避重试，避免整台电台直接失败 */
const requestProgramsPage = async (payload, cookie) => {
    for (let attempt = 0; ; attempt += 1) {
        const res = await request('POST', PROGRAM_URL, payload, { crypto: 'weapi', cookie: cookie || {} })
        if (!isRateLimited(res) || attempt >= RATE_LIMIT_RETRIES) return res
        await delay(djPageDelay() * 2 * (attempt + 1))
    }
}

export const map_program_list = (programs = []) => {
    return programs.map((program) => {
        const song = program.mainSong || {}
        const artists = song.artists || song.ar || []
        const songId = song.id || program.id
        const author =
            artists.reduce((i, v) => (i ? `${i} / ${v.name}` : v.name), '') ||
            program.dj?.nickname ||
            ''

        return {
            title: program.name || song.name || '',
            author,
            album: song.al?.name || song.album?.name || '',
            pic: program.coverUrl || song.album?.picUrl || songId,
            url: songId,
            lrc: songId,
            id: String(program.id),
        }
    })
}

export const map_radio_list = (radios = []) => {
    return radios.map((radio) => ({
        title: radio.name || '',
        author: radio.dj?.nickname || '',
        pic: radio.picUrl || radio.intervenePicUrl || '',
        id: String(radio.id),
        url: String(radio.id),
        trackCount: radio.programCount || 0,
    }))
}

/** 电台节目列表 */
export const get_dj_programs = async (id, cookie = '', options = {}) => {
    const limit = options.limit ?? 100
    let offset = options.offset ?? 0
    const loadAll = options.limit === undefined && options.offset === undefined
    const programs = []
    const seen = new Set()

    while (true) {
        const res = await requestProgramsPage({ radioId: id, limit, offset, asc: false }, cookie)
        if (res.code && Number(res.code) !== 200) {
            // 已经拿到部分节目时，宁可返回不完整列表也不要整单失败
            if (isRateLimited(res) && programs.length) {
                console.warn(`[netease] 电台 ${id} 请求被限频，先返回已获取的 ${programs.length} 个节目`)
                break
            }
            if (isRateLimited(res)) throw new Error('网易云电台请求过于频繁，请稍后重试或配置 MUSIC_U Cookie')
            throw new Error(messageOf(res) || '网易云电台节目加载失败')
        }
        const batch = res.programs || []
        const previousCount = programs.length
        for (const program of batch) {
            const programId = String(program.id || program.mainSong?.id)
            if (seen.has(programId)) continue
            seen.add(programId)
            programs.push(program)
        }
        if (!loadAll || !batch.length || programs.length === previousCount || res.more === false) break
        offset += batch.length
        const total = Number(res.count) || 0
        if (total > 0 && offset >= total) break
        if (res.more !== true && total <= 0 && batch.length < limit) break
        await delay(djPageDelay())
    }

    return map_program_list(programs)
}

/** 电台详情 */
export const get_dj_detail = async (id, cookie = '') => {
    const data = { id }

    const res = await request(
        'POST',
        'https://music.163.com/weapi/djradio/v2/get',
        data,
        { crypto: 'weapi', cookie: cookie || {} },
    )

    const radio = res.data || res.djRadio
    if (!radio) {
        throw res
    }

    return map_radio_list([radio])
}

/** 单集（节目）详情 */
export const get_dj_program_detail = async (id, cookie = '') => {
    const data = { id }

    const res = await request(
        'POST',
        'https://music.163.com/weapi/dj/program/detail',
        data,
        { crypto: 'weapi', cookie: cookie || {} },
    )

    if (!res.program) {
        throw res
    }

    return map_program_list([res.program])
}

/**
 * 热门 / 推荐电台
 * id=recommend → 推荐；其余（含 hot / 留空）→ 热门
 */
export const get_dj_hot = async (id = '', cookie = '') => {
    if (String(id).toLowerCase() === 'recommend') {
        const res = await request(
            'POST',
            'https://music.163.com/weapi/djradio/recommend/v1',
            {},
            { crypto: 'weapi', cookie: cookie || {} },
        )
        return map_radio_list(res.djRadios || [])
    }

    const data = {
        limit: 30,
        offset: 0,
    }

    const res = await request(
        'POST',
        'https://music.163.com/weapi/djradio/hot/v1',
        data,
        { crypto: 'weapi', cookie: cookie || {} },
    )

    return map_radio_list(res.djRadios || [])
}

/** 电台搜索（id 填关键词） */
export const get_search_djs = async (id, cookie = '') => {
    const data = {
        s: id,
        type: 1009,
        limit: 30,
        offset: 0,
        total: true,
    }

    const res = await request('POST', `https://interface.music.163.com/eapi/cloudsearch`, data, {
        crypto: 'eapi',
        cookie: cookie || {},
        url: '/api/cloudsearch/pc',
    })

    return map_radio_list(res.result?.djRadios || [])
}
