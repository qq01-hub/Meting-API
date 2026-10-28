import config from "../../config.js"
import { get_song_url } from "./song.js"
import { changeUrlQuery } from "./util.js"

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

const map_song = (song) => {
    const songmid = song.songmid || song.mid
    const albummid = song.albummid || song.album?.mid || ''
    return {
        author: (song.singer || []).reduce((i, v) => ((i ? i + " / " : i) + v.name), ''),
        title: song.songname || song.name || song.title || '',
        album: song.albumname || song.album?.name || '',
        pic: albummid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg` : '',
        url: config.OVERSEAS ? '' : songmid,
        lrc: songmid,
        songmid,
    }
}

/** 旧接口：部分歌单因隐私设置返回 subcode=4000 且无 cdlist */
const get_playlist_legacy = async (id, uin) => {
    const data = {
        type: 1,
        utf8: 1,
        disstid: id,
        loginUin: uin,
        format: 'json'
    }

    const headers = {
        Referer: 'https://y.qq.com/n/yqq/playlist',
    }

    const url = changeUrlQuery(data, 'http://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg')
    const result = await (await fetch(url, { headers })).json()
    return result?.cdlist?.[0]?.songlist || null
}

/** 新接口：绕过旧接口隐私限制 */
const get_playlist_dissinfo = async (id, uin) => {
    const disstid = parseInt(id, 10)
    const pageSize = 1000
    const songs = []
    let songBegin = 0
    let total = Infinity

    while (songBegin < total) {
        const body = {
            comm: {
                cv: 4747474,
                ct: 24,
                format: 'json',
                inCharset: 'utf-8',
                outCharset: 'utf-8',
                platform: 'yqq.json',
                needNewCode: 1,
                uin: uin || 0,
            },
            req_1: {
                module: 'music.srfDissInfo.aiDissInfo',
                method: 'uniform_get_Dissinfo',
                param: {
                    disstid,
                    userinfo: 1,
                    tag: 1,
                    orderlist: 1,
                    song_begin: songBegin,
                    song_num: pageSize,
                    onlysonglist: 0,
                    enc_host_uin: '',
                },
            },
        }

        const headers = {
            Origin: 'https://y.qq.com',
            Referer: `https://y.qq.com/n/yqq/playsquare/${id}.html`,
            'Content-Type': 'application/json',
        }

        const result = await (await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        })).json()

        if (result?.code !== 0 || result?.req_1?.code !== 0) {
            throw new Error(result?.req_1?.msg || result?.msg || 'tencent playlist dissinfo failed')
        }

        const data = result.req_1.data || {}
        const list = data.songlist || []
        songs.push(...list)

        total = data.dirinfo?.songnum ?? data.songnum ?? songs.length
        if (!list.length) break
        songBegin += list.length
        if (list.length < pageSize) break
    }

    return songs
}

const get_playlist = async (id, cookie = '') => {
    const cookieObj = parseCookieString(cookie)
    const uin = cookieObj.uin || cookieObj.wxuin || '0'

    let songlist = await get_playlist_legacy(id, uin)
    if (!songlist) {
        songlist = await get_playlist_dissinfo(id, uin)
    }

    let jsonp
    if (config.OVERSEAS) {
        const ids = songlist.map(song => song.songmid || song.mid)
        jsonp = (await get_song_url(ids.join(','), cookie))?.url || ''
    }

    const res = songlist.map(map_song)
    if (config.OVERSEAS && res.length) res[0].url = jsonp
    return res
}


export { get_playlist }
