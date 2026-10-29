import { describe, expect, it, vi } from 'vitest'
import store, { selectActiveCookie, selectFmCookie, selectCookieForQuality, selectRequestCookie } from './store.js'

const cookie = (note, userInfo = {}, updatedAt = 1) => ({ note, userInfo, updatedAt })

describe('Meting 全局 Cookie 优先级', () => {
    it('新增接口日志后立即持久化', async () => {
        const save = vi.spyOn(store, 'saveToFile').mockResolvedValue()
        const originalLogs = store.apiLogs
        store.apiLogs = []
        try {
            await store.addApiLog({ method: 'GET', path: '/api', status: 403 })
            expect(save).toHaveBeenCalledTimes(1)
        } finally {
            store.apiLogs = originalLogs
            save.mockRestore()
        }
    })

    it('记录账号普通成功请求和 FM 成功请求次数', async () => {
        const account = { id: 'counter-account', platform: 'netease', requestSuccessCount: 2, fmSuccessCount: 1 }
        const save = vi.spyOn(store, 'saveToFile').mockResolvedValue()
        store.cookies.set(account.id, account)
        try {
            await store.recordCookieRequestSuccess(account.id)
            await store.recordCookieFmSuccess(account.id)
            expect(account.requestSuccessCount).toBe(3)
            expect(account.fmSuccessCount).toBe(2)
            expect(save).toHaveBeenCalled()
        } finally {
            store.cookies.delete(account.id)
            save.mockRestore()
        }
    })

    it('Cookie 列表按平台排序且无会员账号排在前面', () => {
        const accounts = [
            { id: 'qishui-vip', platform: 'qishui', userInfo: { isVip: true }, createdAt: 1 },
            { id: 'netease-vip', platform: 'netease', userInfo: { isVip: true }, createdAt: 2 },
            { id: 'netease-free', platform: 'netease', userInfo: { isVip: false }, createdAt: 3 },
            { id: 'kugou-free', platform: 'kugou', userInfo: { isVip: false }, createdAt: 4 },
            { id: 'tencent-free', platform: 'tencent', userInfo: { isVip: false }, createdAt: 5 },
        ]
        const original = new Map(store.cookies)
        try {
            store.cookies.clear()
            accounts.forEach(account => store.cookies.set(account.id, account))
            expect(store.getCookies().map(account => account.id)).toEqual([
                'netease-free', 'netease-vip', 'tencent-free', 'kugou-free', 'qishui-vip',
            ])
        } finally {
            store.cookies.clear()
            original.forEach((account, id) => store.cookies.set(id, account))
        }
    })

    it('共享 SVIP 优先于基础 VIP 和基础非会员', () => {
        const baseVip = cookie('基础 QQ', { isVip: true }, 3)
        const sharedSvip = cookie('contribution:tencent:1', { isVip: true, isSvip: true }, 1)
        expect(selectActiveCookie([baseVip, sharedSvip])).toBe(sharedSvip)
    })

    it('没有共享 SVIP 时基础账号优先于共享 VIP', () => {
        const baseFree = cookie('基础网易', { isVip: false }, 1)
        const sharedVip = cookie('contribution:netease:1', { isVip: true }, 3)
        expect(selectActiveCookie([sharedVip, baseFree])).toBe(baseFree)
    })

    it('同档位按更新时间选择', () => {
        const oldBase = cookie('基础一', {}, 1)
        const newBase = cookie('基础二', {}, 2)
        expect(selectActiveCookie([oldBase, newBase])).toBe(newBase)
    })

    it('FM 优先账号覆盖普通账号选择', () => {
        const fmCookie = cookie('FM账号', {}, 1)
        const newerCookie = cookie('普通账号', {}, 2)
        fmCookie.fmPriority = true

        expect(selectFmCookie([newerCookie, fmCookie])).toBe(fmCookie)
    })

    it('FM 优先账号能播放目标音质时继续使用该账号', () => {
        const fmCookie = cookie('FM账号', { canPlayVip: true }, 1)
        fmCookie.fmPriority = true
        const otherCookie = cookie('普通账号', { canPlayVip: true }, 2)

        expect(selectCookieForQuality([otherCookie, fmCookie], '320', 'netease', true)).toBe(fmCookie)
    })

    it('FM 优先账号会员不足时使用其他可播放账号，但保留 FM 歌曲 ID 由调用方传递', () => {
        const fmCookie = cookie('FM账号', { canPlayVip: false }, 2)
        fmCookie.fmPriority = true
        const vipCookie = cookie('高音质账号', { canPlayVip: true }, 1)

        expect(selectCookieForQuality([fmCookie, vipCookie], '320', 'netease', true)).toBe(vipCookie)
    })

    describe.each(['netease', 'tencent', 'qishui', 'kugou'])('%s 非会员 FM 账号仅用于列表', (platform) => {
        it.each(['standard', '128', undefined])('默认或标准音质 %s 使用其他会员账号', (quality) => {
            const fm = { ...cookie('FM账号', { isVip: false, canPlayVip: false }, 3), fmPriority: true }
            const vip = cookie('contribution:vip', { canPlayVip: true }, 1)
            const free = cookie('普通非会员', { isVip: false }, 2)

            expect(selectFmCookie([fm, vip, free])).toBe(fm)
            expect(selectCookieForQuality([fm, vip, free], quality, platform, true)).toBe(vip)
        })

        it('仅有非会员 FM 优先账号时不将该账号用于播放', () => {
            const fm = { ...cookie('FM账号', { canPlayVip: false }), fmPriority: true }
            expect(selectCookieForQuality([fm], 'standard', platform, true)).toBeNull()
        })

        it('没有会员账号时不使用任何非会员账号尝试播放', () => {
            const fm = { ...cookie('FM账号', { canPlayVip: false }, 2), fmPriority: true }
            const free = cookie('普通非会员', { canPlayVip: false }, 1)
            expect(selectCookieForQuality([fm, free], 'standard', platform, true)).toBeNull()
        })

        it('播放失败回退也不会重新选中仅用于列表的非会员 FM 账号', () => {
            const fm = { id: 'fm', platform, cookie: 'FM', isActive: true, isValid: true, userInfo: { canPlayVip: false } }
            const vip = { id: 'vip', platform, cookie: 'VIP', isActive: true, isValid: true, userInfo: { canPlayVip: true } }
            const getCookies = vi.spyOn(store, 'getCookies').mockReturnValue([fm, vip])
            const priority = vi.spyOn(store, 'getFmPriorityCookieId').mockReturnValue('fm')
            try {
                expect(store.getFallbackCookieForQuality(platform, 'standard', 'vip')).toBeNull()
            } finally {
                getCookies.mockRestore()
                priority.mockRestore()
            }
        })

        it('普通非 FM 播放请求也跳过非会员账号', () => {
            const fm = { ...cookie('FM账号', { canPlayVip: false }, 2), fmPriority: true }
            const vip = cookie('contribution:vip', { canPlayVip: true }, 1)
            expect(selectCookieForQuality([fm, vip], 'standard', platform)).toBe(vip)
        })
    })

    describe.each(['netease', 'tencent', 'qishui', 'kugou'])('%s 播放账号必须具备会员权益', (platform) => {
        it.each([false, true])('所有音质与缺失会员信息都不选非会员账号，FM=%s', (preferFm) => {
            const accounts = [cookie('非会员', { isVip: false }), cookie('无权益信息')]
            accounts.push({ note: '尚未验证会员' })
            for (const quality of [undefined, 'standard', '128', '320', 'lossless', 'master']) {
                expect(selectCookieForQuality(accounts, quality, platform, preferFm)).toBeNull()
            }
        })

        it('普通播放失败后不回退到非会员账号', () => {
            const getCookies = vi.spyOn(store, 'getCookies').mockReturnValue([
                { id: 'free', platform, isActive: true, isValid: true, userInfo: { isVip: false } },
                { id: 'unknown', platform, isActive: true, isValid: true },
            ])
            try {
                expect(store.getFallbackCookieForQuality(platform, 'standard', 'vip')).toBeNull()
                expect(store.getActiveCookieForFm(platform)?.id).toBe('free')
            } finally {
                getCookies.mockRestore()
            }
        })
    })

    it.each(['netease', 'tencent', 'qishui', 'kugou'])('%s FM 回退随机选择 VIP 并跳过非 VIP', (platform) => {
        const preferred = { id: 'preferred', platform, cookie: 'PREFERRED', isActive: true, isValid: true, userInfo: { canPlayVip: false } }
        const free = { id: 'free', platform, cookie: 'FREE', isActive: true, isValid: true, userInfo: { canPlayVip: false } }
        const vip = { id: 'vip', platform, cookie: 'VIP', isActive: true, isValid: true, userInfo: { canPlayVip: true } }
        const getCookies = vi.spyOn(store, 'getCookies').mockReturnValue([preferred, free, vip])
        const random = vi.spyOn(Math, 'random').mockReturnValue(0)
        try {
            expect(store.getFallbackCookieForFm(platform, ['preferred'])).toBe(vip)
        } finally {
            getCookies.mockRestore()
            random.mockRestore()
        }
    })

    it('FM 账号失败后进入短暂冷却，成功后恢复可选', async () => {
        const account = { id: 'fm-cooldown', platform: 'netease', cookie: 'FM', isActive: true, isValid: true, userInfo: { canPlayVip: true } }
        const getCookies = vi.spyOn(store, 'getCookies').mockReturnValue([account])
        const now = vi.spyOn(Date, 'now').mockReturnValue(1000)
        store.cookies.set(account.id, account)
        try {
            await store.recordCookieFmFailure(account.id)
            expect(store.getActiveCookieForFm('netease')).toBeNull()
            now.mockReturnValue(31001)
            expect(store.getActiveCookieForFm('netease')).toBe(account)
            await store.recordCookieFmSuccess(account.id)
            expect(account.fmCooldownUntil).toBe(0)
        } finally {
            store.cookies.delete(account.id)
            getCookies.mockRestore()
            now.mockRestore()
        }
    })

    it('显式指定 Cookie 时不使用 FM 优先账号', () => {
        const explicitCookie = 'MUSIC_U=explicit'
        const fmCookie = cookie('FM账号')
        fmCookie.fmPriority = true

        expect(selectRequestCookie(explicitCookie, fmCookie)).toBe(explicitCookie)
    })

    it('失败后只选择其他具备目标音质权限的账号，累计次数不禁用账号', async () => {
        const fmCookie = { id: 'fm-test', platform: 'netease', isActive: true, isValid: true, userInfo: { canPlaySvip: true } }
        const backup = { id: 'backup-test', platform: 'netease', isActive: true, isValid: true, userInfo: { canPlaySvip: true } }
        const free = { id: 'free-test', platform: 'netease', isActive: true, isValid: true, userInfo: { canPlaySvip: false } }
        const getCookies = vi.spyOn(store, 'getCookies').mockReturnValue([fmCookie, backup, free])
        const saveToFile = vi.spyOn(store, 'saveToFile').mockResolvedValue()
        store.cookies.set(fmCookie.id, fmCookie)
        try {
            expect(store.getFallbackCookieForQuality('netease', 'sky', fmCookie.id)).toBe(backup)
            getCookies.mockReturnValue([fmCookie, free])
            expect(store.getFallbackCookieForQuality('netease', 'sky', fmCookie.id)).toBeNull()
            await store.recordCookieUrlFailure(fmCookie.id)
            await store.recordCookieUrlFailure(fmCookie.id)
            expect(fmCookie.urlErrorCount).toBe(2)
            expect(fmCookie.isValid).toBe(true)
            expect(fmCookie.isActive).toBe(true)
            expect(saveToFile).toHaveBeenCalledTimes(2)
        } finally {
            store.cookies.delete(fmCookie.id)
            getCookies.mockRestore()
            saveToFile.mockRestore()
        }
    })

    it('keeps Tencent slider status across requests and clears it after playback succeeds', async () => {
        const account = { id: 'tencent-slider-test', platform: 'tencent', cookie: 'uin=123;qqmusic_key=test', urlErrorCount: 2 }
        const save = vi.spyOn(store, 'saveToFile').mockResolvedValue()
        store.cookies.set(account.id, account)
        try {
            await store.recordCookieUrlFailure(account.id, '0010BrWk2SucQr', true)
            expect(account).toMatchObject({ urlErrorCount: 3, lastFailedSongmid: '0010BrWk2SucQr', tencentVerificationSongmid: '0010BrWk2SucQr' })
            expect(account.tencentSliderCount).toBe(1)
            await store.recordCookieUrlFailure(account.id, 'other-song', false)
            expect(account.tencentSliderCount).toBe(1)
            await store.recordCookieUrlFailure(account.id, 'other-song', true)
            expect(account.tencentSliderCount).toBe(2)
            expect(save).toHaveBeenCalled()
            await store.recordCookieUrlSuccess(account.id)
            expect(account).toMatchObject({ urlErrorCount: 0, lastFailedSongmid: '', tencentVerificationSongmid: '' })
            expect(account.tencentSliderCount).toBe(2)
        } finally {
            store.cookies.delete(account.id)
            save.mockRestore()
        }
    })

    it('clears a stale Tencent slider marker once later requests no longer require verification', async () => {
        const account = { id: 'tencent-stale-test', platform: 'tencent', cookie: 'uin=123;qqmusic_key=test', urlErrorCount: 5, tencentVerificationSongmid: '0010BrWk2SucQr', tencentSliderCount: 1, tencentCooldownUntil: 1 }
        const save = vi.spyOn(store, 'saveToFile').mockResolvedValue()
        store.cookies.set(account.id, account)
        try {
            await store.recordCookieUrlFailure(account.id, 'other-song', false)
            expect(account).toMatchObject({ urlErrorCount: 6, lastFailedSongmid: 'other-song', tencentVerificationSongmid: '', tencentCooldownUntil: 0 })
            expect(account.tencentSliderCount).toBe(1)
            expect(save).toHaveBeenCalledTimes(1)

            account.tencentVerificationSongmid = 'live-song'
            account.tencentCooldownUntil = Date.now() + 60000
            await store.clearTencentSliderState(account.id)
            expect(account.tencentVerificationSongmid).toBe('')
            expect(account.tencentCooldownUntil).toBe(0)
            expect(save).toHaveBeenCalledTimes(2)
        } finally {
            store.cookies.delete(account.id)
            save.mockRestore()
        }
    })

    it('temporarily skips slider accounts for normal, FM and quality selection', async () => {
        const account = { id: 'cooldown-test', platform: 'tencent', cookie: 'uin=123', isActive: true, isValid: true, updatedAt: 2, userInfo: { canPlaySvip: true } }
        const backup = { id: 'cooldown-backup', platform: 'tencent', cookie: 'uin=456', isActive: true, isValid: true, updatedAt: 1, userInfo: { canPlayVip: true, canPlaySvip: true } }
        const getCookies = vi.spyOn(store, 'getCookies').mockReturnValue([account, backup])
        const save = vi.spyOn(store, 'saveToFile').mockResolvedValue()
        const priority = vi.spyOn(store, 'getFmPriorityCookieId').mockReturnValue(account.id)
        const now = vi.spyOn(Date, 'now').mockReturnValue(1000000)
        store.cookies.set(account.id, account)
        try {
            await store.recordCookieUrlFailure(account.id, 'song', true)
            expect(account.tencentCooldownUntil).toBe(4600000)
            expect(account.isValid).toBe(true)
            expect(store.getActiveCookie('tencent')).toBe(backup)
            expect(store.getActiveCookieForFm('tencent')).toBe(backup)
            expect(store.getActiveCookieForQuality('tencent', 'master', true)?.id).toBe(backup.id)
            expect(store.getFallbackCookieForQuality('tencent', 'master', backup.id)).toBeNull()
            now.mockReturnValue(4600000)
            expect(store.getActiveCookie('tencent')).toBe(account)
            await store.recordCookieUrlFailure(account.id, 'song', true)
            await store.recordCookieUrlSuccess(account.id)
            expect(account.tencentCooldownUntil).toBe(0)
            expect(store.getActiveCookieForFm('tencent')).toBe(account)
        } finally {
            store.cookies.delete(account.id)
            getCookies.mockRestore()
            save.mockRestore()
            priority.mockRestore()
            now.mockRestore()
        }
    })
})
