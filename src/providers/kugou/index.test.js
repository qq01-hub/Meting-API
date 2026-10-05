import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import kugou, { buildKugouDevice, decodeKugouGcid, mapKugouSong, normalizeKugouId, buildKugouSignature, buildKugouSongRequest, extractKugouSongs, isKugouNonFatalError, buildKugouPlaylistRequest, isKugouShareCode, extractKugouShareCollectionId, buildKugouShareRequest, buildKugouShareKey } from './index.js'

afterEach(() => vi.unstubAllGlobals())

describe('kugou provider contract', () => {
  it('registers the unified Meting capabilities', () => {
    const registry = { register: (name, value) => { registry.name = name; registry.value = value } }
    kugou.register(registry)
    expect(registry.name).toBe('kugou')
    expect(registry.value.support_type).toEqual(expect.arrayContaining([
      'url', 'pic', 'lrc', 'song', 'playlist', 'search', 'search_playlist', 'fm',
    ]))
  })

  it('normalizes a Kugou song hash or composite id', () => {
    expect(normalizeKugouId('ABCDEF,123')).toEqual({ hash: 'abcdef', albumAudioId: 123 })
    expect(normalizeKugouId('ABCDEF')).toEqual({ hash: 'abcdef', albumAudioId: 0 })
  })

  it('builds the audio metadata request as a signed GET query', () => {
    expect(buildKugouSongRequest('ABCDEF,123')).toMatchObject({
      path: '/v1/audio/audio', method: 'GET', base: 'http://kmr.service.kugou.com',
      params: { data: [{ hash: 'abcdef', audio_id: 123 }] },
    })
  })

  it('maps Kugou search records to the shared song shape', () => {
    expect(mapKugouSong({
      hash: 'ABC', songname: '测试', singername: '歌手', album_name: '专辑',
      img: 'http://s1.example/{size}', duration: 215,
    })).toMatchObject({
      id: 'abc', title: '测试', author: '歌手', album: '专辑',
      pic: 'https://s1.example/400', duration: 215, url: 'abc', lrc: 'abc',
    })
  })

  it('extracts direct audio metadata arrays returned by Kugou', () => {
    expect(extractKugouSongs({ data: [{ hash: 'ABCDEF', audio_name: '歌手 - 歌名' }] })).toMatchObject([
      { id: 'abcdef', title: '歌名', author: '歌手' },
    ])
  })

  it('maps the public Web search record shape', () => {
    expect(mapKugouSong({
      FileHash: 'ABCDEF', FileName: '歌手 - 测试歌曲', SingerName: '歌手', AlbumName: '专辑',
      Image: 'http://s1.example/{size}', Duration: 215,
    })).toMatchObject({
      id: 'abcdef', title: '测试歌曲', author: '歌手', album: '专辑',
      pic: 'https://s1.example/400', duration: 215, url: 'abcdef', lrc: 'abcdef',
    })
  })

  it('only accepts collection ids for playlist requests', async () => {
    const { isKugouCollectionId } = await import('./index.js')
    expect(isKugouCollectionId('collection_3_975665376_1162_0')).toBe(true)
    expect(isKugouCollectionId('gcid_3zik61ilzx7z09d')).toBe(false)
    expect(isKugouCollectionId('1852429')).toBe(false)
    expect(isKugouCollectionId('https://m.kugou.com/songlist/gcid_3zik61ilzx7z09d/')).toBe(false)
  })

  it('maps legacy Android playlist records with audio_name and authors', () => {
    expect(mapKugouSong({
      hash: 'ABCDEF', audio_name: 'Rosy赵露思 - 有你在 (Whatever官方中文版)',
      authors: [{ author_name: 'Rosy赵露思' }], albuminfo: { name: '有你在' }, timelen: 152607,
    })).toMatchObject({
      id: 'abcdef', title: '有你在 (Whatever官方中文版)', author: 'Rosy赵露思', album: '有你在', duration: 153,
    })
  })

  it('decodes gcid fields in base 35 without losing large integer precision', () => {
    expect(decodeKugouGcid('gcid_3zfpq2kyzmz04f')).toBe('collection_3_826461684_22_0')
    expect(decodeKugouGcid('3zik61ilzx7z09d')).toBe('collection_3_975665376_1162_0')
    const userid = '9007199254740993'
    expect(decodeKugouGcid(`gcid_3z${BigInt(userid).toString(35)}zmz04f`)).toBe(`collection_3_${userid}_22_0`)
    expect(decodeKugouGcid('gcid_3zfpq2kyzmz0')).toBe('')
    expect(decodeKugouGcid('gcid_3zfpq2kyzz04f')).toBe('')
    expect(decodeKugouGcid('gcid_invalid')).toBe('')
  })

  it('decodes desktop and mobile sharing URLs locally regardless of tracking parameters', () => {
    expect(decodeKugouGcid('https://www.kugou.com/songlist/gcid_3zik61ilzx7z09d/?chl=wechat')).toBe('collection_3_975665376_1162_0')
    expect(decodeKugouGcid('https://m.kugou.com/songlist/gcid_3zfpq2kyzmz04f/?src_cid=3zfpq2kyzmz04f&uid=826461684&chl=qq_client&iszlist=1&qq_aio_chat_type=3 ')).toBe('collection_3_826461684_22_0')
    expect(decodeKugouGcid('https://m3ws.kugou.com/songlist/gcid_3zfpq2kyzmz04f/')).toBe('collection_3_826461684_22_0')
    expect(decodeKugouGcid('https://kugou.com.example.org/songlist/gcid_3zfpq2kyzmz04f/')).toBe('')
  })

  it('recognizes numeric Kugou share codes without confusing playlist ids', () => {
    expect(isKugouShareCode('39499569')).toBe(true)
    expect(isKugouShareCode(' collection_3_975665376_1162_0 ')).toBe(false)
    expect(isKugouShareCode('1852429')).toBe(false)
  })

  it('builds the legacy share-code command request from dynamic device values', () => {
    const request = buildKugouShareRequest('39499569', {
      mid: 'mid-1', clienttime: 841742523, clienttimems: 1788398523665, deviceId: 'device-1',
    })
    expect(request).toMatchObject({
      url: 'http://t.kugou.com/command/', method: 'POST',
      headers: expect.objectContaining({ 'KG-CLIENTTIMEMS': '1788398523665', 'KG-DEVID': 'device-1' }),
      body: { appid: 1001, clientver: 20141, mid: 'mid-1', clienttime: 841742523, data: '39499569', key: expect.any(String) },
    })
    expect(buildKugouShareKey('39499569')).toBe(request.body.key)
  })

  it('extracts a collection id from either command response field', () => {
    expect(extractKugouShareCollectionId({ status: 1, err_code: 0, data: { info: { global_collection_id: 'collection_3_975665376_1162_0' } } })).toBe('collection_3_975665376_1162_0')
    expect(extractKugouShareCollectionId({ status: 1, err_code: 0, data: { info: { copy_gcid: 'collection_3_975665376_1162_0' } } })).toBe('collection_3_975665376_1162_0')
    expect(extractKugouShareCollectionId({ status: 0, err_code: 20006, data: { info: {} } })).toBe('')
  })

  it('maps Kugou search playlist results to the global collection id', async () => {
    const { mapKugouPlaylist } = await import('./index.js')
    expect(mapKugouPlaylist({ specialid: 1852429, gid: 'collection_3_975665376_920_0', specialname: '测试歌单' })).toMatchObject({
      id: 'collection_3_975665376_920_0',
      url: 'collection_3_975665376_920_0',
    })
  })

  it('builds the tracker key required by the play-url endpoint', async () => {
    const { buildKugouTrackKey } = await import('./index.js')
    expect(buildKugouTrackKey('abcdef', { KUGOU_API_MID: 'device-mid', userid: '42' })).toBe('1caced7d174e717d08ddd25bc1990975')
  })

  it('reports the actual standard quality when an SVIP request returns a 128kbps MP3', async () => {
    const { getKugouActualQuality } = await import('./index.js')
    expect(getKugouActualQuality({ bitRate: 128000, extName: 'mp3', fileSize: 4_162_655 })).toMatchObject({ name: '标准' })
  })

  it('uses the reference personal FM endpoint request shape', async () => {
    const { buildKugouFmRequest } = await import('./index.js')
    const request = buildKugouFmRequest({ userid: '42', token: 'token-1', vip_type: '1', KUGOU_API_MID: 'mid-1' }, 1700000000000)
    expect(request).toMatchObject({
      path: '/v2/personal_recommend',
      method: 'POST',
      router: 'persnfm.service.kugou.com',
      body: expect.objectContaining({ appid: 3116, clientver: 11440, clienttime: 1700000000000, userid: '42', kguid: '42', token: 'token-1', vip_type: '1' }),
    })
    expect(request.body.key).toHaveLength(32)
  })

  it('uses media metadata instead of a requested master flag on a downgraded response', async () => {
    const { getKugouActualQuality } = await import('./index.js')
    expect(getKugouActualQuality({ quality: 'super', bitRate: 128000, extName: 'mp3', fileSize: 4_162_655 })).toMatchObject({ name: '标准' })
  })

  it('prefers explicit Viper quality metadata returned by Kugou', async () => {
    const { getKugouActualQuality } = await import('./index.js')
    expect(getKugouActualQuality({ quality: 'viper_tape', bitRate: 128000, extName: 'mp3' })).toMatchObject({ name: '蝰蛇母带音质' })
    expect(getKugouActualQuality({ quality_name: 'viper_hifi', bitRate: 128000, extName: 'mp3' })).toMatchObject({ name: '蝰蛇HiFi音质' })
    expect(getKugouActualQuality({ quality: 'multitrack' })).toMatchObject({ name: '多轨音质' })
  })

  it('maps all supported Viper quality aliases to tracker request values', async () => {
    const { getKugouQuality } = await import('./index.js')
    expect(getKugouQuality('hires')).toMatchObject({ request: 'high', name: 'Hi-Res音质' })
    expect(getKugouQuality('atmos')).toMatchObject({ request: 'viper_atmos', name: '蝰蛇全景声2.0' })
    expect(getKugouQuality('viper_tape')).toMatchObject({ request: 'viper_tape', name: '蝰蛇母带音质' })
    expect(getKugouQuality('viper_clear')).toMatchObject({ request: 'viper_clear', name: '蝰蛇超清音质' })
    expect(getKugouQuality('viper_hifi')).toMatchObject({ request: 'viper_hifi', name: '蝰蛇HiFi音质' })
  })

  it('maps Kugou volume metadata to the shared loudness shape', async () => {
    const { mapKugouLoudness } = await import('./index.js')
    expect(mapKugouLoudness({ volume: -10.1, volume_peak: 1.6, volume_gain: 0 })).toEqual({ gain: -10.1, peak: 1.6 })
  })

  it('uses the API cookie device identity in Android request parameters', () => {
    expect(buildKugouDevice({ dfid: 'dfid-1', KUGOU_API_MID: '123456789', KUGOU_API_DEV: 'DEV1234567' })).toMatchObject({
      dfid: 'dfid-1',
      mid: '123456789',
      uuid: '-',
      appid: 3116,
      clientver: 11440,
    })
  })
  it('builds anonymous H5 playlist requests with the reversed signature', () => {
    const request = buildKugouPlaylistRequest('collection_3_826461684_22_0', { page: 2, pagesize: 100, mid: 'device-mid', clienttime: 1700000000000 })
    expect(request).toMatchObject({
      base: 'https://pubsongscdn.kugou.com', path: '/v2/get_other_list_file', signed: false,
      params: { appid: 1058, clientver: 20000, srcappid: 2919, clienttime: 1700000000000,
        mid: 'device-mid', uuid: 'device-mid', dfid: '-', uid: 0, token: '', type: 0,
        module: 'playlist', page: 2, pagesize: 100, global_collection_id: 'collection_3_826461684_22_0' },
    })
    const { signature, ...params } = request.params
    const salt = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt'
    const serialized = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('')
    expect(signature).toBe(createHash('md5').update(salt + serialized + salt).digest('hex'))
    expect(buildKugouPlaylistRequest('5294381').params).toMatchObject({ specialid: '5294381', page: 1, pagesize: 100 })
  })



  it('treats expired or rejected Kugou upstream requests as non-fatal provider misses', () => {
    expect(isKugouNonFatalError({ code: 20010 })).toBe(true)
    expect(isKugouNonFatalError({ code: 200101 })).toBe(true)
    expect(isKugouNonFatalError({ status: 500 })).toBe(true)
    expect(isKugouNonFatalError({ code: 401 })).toBe(false)
  })

  it('creates the Android request signature deterministically', () => {
    expect(buildKugouSignature({ appid: 3116, clientver: 11440, hash: 'abc' }, '')).toBe('c61e6852e071acf8e5435eff08874afe')
  })
  it('fetches every gcid playlist page without HTML, even when a page is shorter than requested', async () => {
    const pageSizes = [70, 100, 100, 47]
    const fetchMock = vi.fn(async (url, options) => {
      expect(url.origin + url.pathname).toBe('https://pubsongscdn.kugou.com/v2/get_other_list_file')
      expect(url.searchParams.get('global_collection_id')).toBe('collection_3_826461684_22_0')
      expect(url.searchParams.get('appid')).toBe('1058')
      expect(options.method).toBe('GET')
      expect(options.headers.Cookie).toBeUndefined()
      expect(url.searchParams.get('token')).toBe('')
      const page = Number(url.searchParams.get('page'))
      return { ok: true, json: async () => ({ status: 1, error_code: 0, data: { count: 317,
        info: Array.from({ length: pageSizes[page - 1] }, (_, index) => ({ hash: `HASH-${page}-${index}`, name: 'Imagine', singerinfo: [{ name: 'John Lennon' }] })),
      } }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const registry = { register: (_, provider) => { registry.provider = provider } }
    kugou.register(registry)
    const songs = await registry.provider.handle('playlist', 'https://m.kugou.com/songlist/gcid_3zfpq2kyzmz04f/?uid=826461684&iszlist=1', 'userid=42;token=private-token')
    expect(songs).toHaveLength(317)
    expect(songs[0]).toMatchObject({ id: 'hash-1-0', title: 'Imagine', author: 'John Lennon' })
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('resolves short-link redirects from Location without reading the sharing page', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 302, headers: new Headers({ location: 'https://activity.kugou.com/share/index.html?global_specialid=collection_3_826461684_22_0' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 1, error_code: 0, data: { count: 1, info: [{ hash: 'ABC' }] } }) })
    vi.stubGlobal('fetch', fetchMock)
    const registry = { register: (_, provider) => { registry.provider = provider } }
    kugou.register(registry)
    expect(await registry.provider.handle('playlist', 'https://t1.kugou.com/example')).toMatchObject([{ id: 'abc' }])
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects malformed gcids and non-Kugou URLs before making requests', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const registry = { register: (_, provider) => { registry.provider = provider } }
    kugou.register(registry)
    await expect(registry.provider.handle('playlist', 'gcid_invalid')).rejects.toThrow('无效')
    await expect(registry.provider.handle('playlist', 'https://example.org/songlist/gcid_3zfpq2kyzmz04f/')).rejects.toThrow('无效')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not return a partial playlist when a later page fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 1, error_code: 0, data: { count: 101, info: [{ hash: 'ABC' }] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 0, error_code: 20010 }) })
    vi.stubGlobal('fetch', fetchMock)
    const registry = { register: (_, provider) => { registry.provider = provider } }
    kugou.register(registry)
    expect(await registry.provider.handle('playlist', 'gcid_3zfpq2kyzmz04f')).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops pagination when the upstream page is empty', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ status: 1, error_code: 0, data: { count: 317, info: [] } }) }))
    vi.stubGlobal('fetch', fetchMock)
    const registry = { register: (_, provider) => { registry.provider = provider } }
    kugou.register(registry)
    expect(await registry.provider.handle('playlist', 'collection_3_826461684_22_0')).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
