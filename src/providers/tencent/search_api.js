import { changeUrlQuery } from "./util.js"

export const parseCookieString = (cookieString) => {
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

export const fetchQQSearch = async (query, searchType, cookie = '') => {
    const cookieObj = parseCookieString(cookie)
    const uin = cookieObj.uin || '0'
    const qqmusic_key = cookieObj.qqmusic_key || ''

    const data = {
        req: {
            method: 'DoSearchForQQMusicDesktop',
            module: 'music.search.SearchCgiService',
            param: {
                query,
                page_num: 1,
                num_per_page: 30,
                search_type: searchType,
            },
        },
        comm: {
            uin,
            format: 'json',
            ct: 24,
            cv: 0,
            authst: qqmusic_key,
        },
    }

    const url = changeUrlQuery({ data: JSON.stringify(data) }, 'https://u.y.qq.com/cgi-bin/musicu.fcg')
    const result = await fetch(url, {
        headers: {
            Referer: 'https://y.qq.com/',
            'User-Agent': 'Mozilla/5.0',
            Cookie: cookie,
        },
    })
    const json = await result.json()
    const body = json?.req?.data?.body || {}
    if (searchType === 0 && Array.isArray(body.song?.list) && body.song.list.length > 0) {
        return body
    }
    if (searchType === 3 && Array.isArray(body.songlist?.list) && body.songlist.list.length > 0) {
        return body
    }

    // 新版 Desktop 搜索偶尔返回 estimate_sum>0 但 list 为空，回退到仍可用的公开搜索接口。
    if (searchType === 3) {
        const legacyUrl = changeUrlQuery({
            remoteplace: 'txt.yqq.playlist',
            searchid: Date.now(),
            query,
            page_no: 0,
            num_per_page: 30,
            format: 'json',
        }, 'https://c.y.qq.com/soso/fcgi-bin/client_music_search_songlist')
        const legacy = await (await fetch(legacyUrl, {
            headers: { Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0', Cookie: cookie },
        })).json()
        return { songlist: { list: legacy?.data?.list || [] } }
    }

    const legacyUrl = changeUrlQuery({
        p: 1,
        n: 30,
        w: query,
        format: 'json',
    }, 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp')
    const legacy = await (await fetch(legacyUrl, {
        headers: { Referer: 'https://y.qq.com/', 'User-Agent': 'Mozilla/5.0', Cookie: cookie },
    })).json()
    const songs = (legacy?.data?.song?.list || []).map((song) => ({
        name: song.songname,
        singer: song.singer || [],
        album: { mid: song.albummid || '', name: song.albumname || '' },
        mid: song.songmid,
        interval: song.interval,
    }))
    return { song: { list: songs } }
}
