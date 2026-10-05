import { afterEach, describe, expect, it, vi } from 'vitest'
import { isKugouMembershipRequestParamError, mapKugouMembership, parseKugouCookie } from '../providers/kugou/index.js'
import { validateKugouCookie } from './cookie-validator.js'


describe('酷狗 Cookie 解析', () => {
  it('接受浏览器复制后带末尾分号的 Cookie', () => {
    expect(parseKugouCookie('token=abc; userid=10001;')).toEqual({ token: 'abc', userid: '10001' })
  })
})

describe('酷狗会员接口错误识别', () => {
  it('将 20010 识别为设备参数拒绝，而不是 Cookie 失效', () => {
    expect(isKugouMembershipRequestParamError({ code: 20010 })).toBe(true)
    expect(isKugouMembershipRequestParamError({ code: 20017 })).toBe(true)
    expect(isKugouMembershipRequestParamError({ code: 401 })).toBe(false)
  })
})
describe('酷狗在线验证', () => {
  afterEach(() => vi.unstubAllGlobals())

  const mockResponses = (...payloads) => {
    const fetchMock = vi.fn()
    for (const payload of payloads) {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => payload })
    }
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('token 无效时要求重新扫码，不再查询会员', async () => {
    const fetchMock = mockResponses({ status: 0, error_code: 35005, data: 'token invalid' })
    expect(await validateKugouCookie('token=expired; userid=10001; vip_type=3')).toEqual({
      valid: false,
      error: '酷狗 token 已失效，请重新扫码登录后再验证',
      userInfo: null,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0].pathname).toBe('/v1/user_verify')
  })

  it('只有登录校验通过后，会员参数拒绝才进入待确认状态', async () => {
    for (const code of [20010, 20017]) {
      const fetchMock = mockResponses(
        { status: 1, error_code: 0, data: { auth: 'verified' } },
        { status: 0, error_code: code, data: { errmsg: 'params invalid' } },
      )
      expect(await validateKugouCookie('token=valid; userid=10001; vip_type=3')).toMatchObject({
        valid: true,
        userInfo: { membershipPending: true, isVip: false, isSvip: false, canPlayVip: false, canPlaySvip: false },
      })
      expect(fetchMock.mock.calls[1][0].searchParams.has('product_type')).toBe(false)
    }
  })

  it('缺少认证结果时不能仅凭成功状态判定有效', async () => {
    const fetchMock = mockResponses({ status: 1, error_code: 0, data: {} })
    expect(await validateKugouCookie('token=unknown; userid=10001')).toMatchObject({ valid: false, userInfo: null })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('登录和会员查询均成功时返回在线会员权益', async () => {
    mockResponses(
      { status: 1, error_code: 0, data: { auth: 'verified' } },
      { status: 1, error_code: 0, data: { vip_type: 1, super_vip: 1 } },
    )
    expect(await validateKugouCookie('token=valid; userid=10001')).toMatchObject({
      valid: true,
      userInfo: { userId: '10001', isVip: true, isSvip: true, canPlaySvip: true },
    })
  })
})

describe('酷狗会员权益映射', () => {
  it('将普通豪华 VIP 映射为 VIP，不能播放 SVIP 音质', () => {
    expect(mapKugouMembership({ vip_type: 1 })).toMatchObject({
      vipType: 1,
      isVip: true,
      isSvip: false,
      canPlayVip: true,
      canPlaySvip: false,
    })
  })

  it('不会只因 vip_type 数值把普通 VIP 误判为 SVIP', () => {
    expect(mapKugouMembership({ vip_type: 3 })).toMatchObject({
      isVip: true,
      isSvip: false,
      canPlayVip: true,
      canPlaySvip: false,
    })
  })
  it('将豪华 VIP 或超级会员字段映射为 SVIP 权益', () => {
    expect(mapKugouMembership({ vip_type: 3, super_vip: 1 })).toMatchObject({
      isVip: true,
      isSvip: true,
      canPlayVip: true,
      canPlaySvip: true,
    })
  })
})

