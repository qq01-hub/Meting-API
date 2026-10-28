import { afterEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import { map_song_list as mapNeteaseSongs } from './netease/util.js'
import { map_program_list } from './netease/dj.js'
import { map_song_list as mapTencentSongs } from './tencent/search.js'
import { mapKugouSong } from './kugou/index.js'
import Providers from './index.js'
import api from '../service/api.js'

const app = new Hono().get('/api', api)
const mockResponses = (...payloads) => {
    const fetch = vi.fn()
    for (const payload of payloads) fetch.mockResolvedValueOnce(new Response(JSON.stringify(payload)))
    vi.stubGlobal('fetch', fetch)
}
const queryTencent = type => app.request(`/api?server=tencent&type=${type}&id=test`, {
    headers: { 'X-OpenMusic-Cookie': 'uin=123;qqmusic_key=album-test' },
})
afterEach(() => vi.unstubAllGlobals())

describe('歌曲专辑信息', () => {
    it.each([
        [{ al: { name: '网易新版专辑' } }, '网易新版专辑'],
        [{ album: { name: '网易旧版专辑' } }, '网易旧版专辑'],
        [{}, ''],
    ])('网易云映射保留新旧字段的专辑名，缺失时为空: %j', (fields, album) => {
        const [song] = mapNeteaseSongs({ songs: [{ id: 1, name: '歌曲', ar: [{ name: '歌手' }], ...fields }] })
        expect(song).toMatchObject({ title: '歌曲', author: '歌手', album, url: 1 })
    })

    it.each([
        [{ al: { name: '节目专辑' } }, '节目专辑'],
        [{ album: { name: '旧版节目专辑' } }, '旧版节目专辑'],
        [{}, ''],
    ])('网易云节目保留主歌曲专辑而不把电台名当作专辑: %j', (fields, album) => {
        expect(map_program_list([{ id: 2, name: '节目', radio: { name: '电台名' }, mainSong: { id: 1, ...fields } }])[0].album).toBe(album)
    })

    it.each([
        [{ name: 'QQ 专辑', mid: 'album-mid' }, 'QQ 专辑'],
        [undefined, ''],
    ])('QQ 搜索和 FM 的公共映射保留专辑: %j', (albumInfo, album) => {
        expect(mapTencentSongs([{ mid: 'song-mid', name: '歌曲', singer: [], album: albumInfo }])[0].album).toBe(album)
    })

    it.each(['QQ 单曲专辑', undefined])('QQ 单曲 API 返回专辑且保留原有歌曲字段: %s', async album => {
        mockResponses({ songinfo: { data: { track_info: { name: '歌曲', singer: [{ name: '歌手' }], album: { name: album, mid: 'album-mid' } } } } })
        const response = await queryTencent('song')
        expect(response.status).toBe(200)
        expect((await response.json())[0]).toMatchObject({ title: '歌曲', author: '歌手', album: album || '', songmid: 'test' })
    })

    it.each([
        [{ albumname: '旧版歌单专辑', albummid: 'album-mid' }, '旧版歌单专辑'],
        [{ album: { name: '新版歌单专辑', mid: 'album-mid' } }, '新版歌单专辑'],
        [{}, ''],
    ])('QQ 歌单 API 保留新旧专辑字段: %j', async (fields, album) => {
        mockResponses({ cdlist: [{ songlist: [{ songmid: 'song-mid', songname: '歌曲', singer: [], ...fields }] }] })
        const response = await queryTencent('playlist')
        expect(response.status).toBe(200)
        expect((await response.json())[0].album).toBe(album)
    })

    it('QQ 旧版搜索回退仍保留专辑信息', async () => {
        mockResponses({ req: { data: { body: {} } } }, { data: { song: { list: [{ songmid: 'song-mid', songname: '歌曲', singer: [], albumname: '旧版搜索专辑', albummid: 'album-mid' }] } } })
        const response = await queryTencent('search')
        expect(response.status).toBe(200)
        expect((await response.json())[0].album).toBe('旧版搜索专辑')
    })

    it('QQ FM API 返回上游专辑信息', async () => {
        mockResponses({ radio: { code: 0, data: { tracks: [{ mid: 'song-mid', name: '歌曲', singer: [], album: { name: '漫游专辑', mid: 'album-mid' } }] } } })
        const response = await queryTencent('fm')
        expect(response.status).toBe(200)
        expect((await response.json())[0].album).toBe('漫游专辑')
    })

    it.each(['汽水专辑', undefined])('汽水已有专辑信息保持兼容: %s', async album => {
        mockResponses({ data: { list: [{ id: '1', name: '歌曲', album_info: { name: album } }] } })
        const [song] = await new Providers().get('qishui').handle('search', '歌曲')
        expect(song.album).toBe(album || '')
    })

    it.each(['酷狗专辑', undefined])('酷狗已有专辑信息保持兼容: %s', album => {
        expect(mapKugouSong({ hash: 'ABC', songname: '歌曲', album_name: album }).album).toBe(album || '')
    })
})
