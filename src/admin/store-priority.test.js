import { describe, expect, it, vi } from 'vitest'
import store, { selectActiveCookie, selectFmCookie, selectCookieForQuality, selectRequestCookie } from './store.js'

const cookie = (note, userInfo = {}, updatedAt = 1) => ({ note, userInfo, updatedAt })

describe('Meting 全局 Cookie 优先级', () => {
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

    it('temporarily skips slider accounts for normal, FM and quality selection', async () => {
        const account = { id: 'cooldown-test', platform: 'tencent', cookie: 'uin=123', isActive: true, isValid: true, updatedAt: 2, userInfo: { canPlaySvip: true } }
        const backup = { id: 'cooldown-backup', platform: 'tencent', cookie: 'uin=456', isActive: true, isValid: true, updatedAt: 1, userInfo: { canPlayVip: true } }
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
