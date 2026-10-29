import { describe, expect, it } from 'vitest'
import { buildRefreshResult } from './refresh.js'

describe('QQ 音乐 Cookie 刷新', () => {
    it('刷新结果保留原有设备标识 Cookie', () => {
        const result = buildRefreshResult({ musickey: 'new-key', refresh_token: 'new-refresh' }, 'o123', 'persisted-device')

        expect(result.cookie).toContain('psrf_qqdevice=persisted-device')
    })
})
