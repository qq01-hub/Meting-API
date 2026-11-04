import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Hono } from 'hono'
import store from './store.js'
import { adminRoutes } from './api.js'

const originalConfig = store.config
const originalDataDir = store.dataDir
const headers = { 'X-Auth-Username': 'config-test-admin', 'X-Auth-Token': 'test-session', 'Content-Type': 'application/json' }
let app
beforeEach(() => {
    store.config = {}
    vi.spyOn(store, 'saveToFile').mockResolvedValue(undefined)
    vi.spyOn(store, 'addLog').mockResolvedValue(undefined)
    vi.spyOn(store, 'validateToken').mockImplementation((username, token) => username === 'config-test-admin' && token === 'test-session')
    store.users.set('config-test-admin', { role: 'admin' })
    app = new Hono()
    adminRoutes(app)
})
afterEach(() => {
    store.config = originalConfig
    store.dataDir = originalDataDir
    store.stopBackupScheduler()
    store.users.delete('config-test-admin')
    vi.restoreAllMocks()
})
const update = enabled => app.request('/admin/config/openmusic-auth', { method: 'PUT', headers, body: JSON.stringify({ enabled }) })
const updateBackup = enabled => app.request('/admin/config/backup', { method: 'PUT', headers, body: JSON.stringify({ enabled }) })

describe('管理 OpenMusic 授权配置', () => {
    it('旧配置默认开启且可保存关闭和重新开启', async () => {
        expect((await (await app.request('/admin/config', { headers })).json()).data.openmusicAuthEnabled).toBe(true)
        for (const enabled of [false, true]) {
            const response = await update(enabled)
            expect(response.status).toBe(200)
            expect((await response.json()).data.openmusicAuthEnabled).toBe(enabled)
            expect((await (await app.request('/admin/config', { headers })).json()).data.openmusicAuthEnabled).toBe(enabled)
        }
        expect(store.saveToFile).toHaveBeenCalledTimes(2)
        expect(store.addLog).toHaveBeenCalledWith('config_update', expect.any(String), 'config-test-admin')
    })
    it('拒绝非布尔值且不更改配置或写盘', async () => {
        for (const enabled of [undefined, null, 'false', 0, {}]) {
            expect((await update(enabled)).status).toBe(400)
            expect(store.getConfig().openmusicAuthEnabled).toBe(true)
        }
        expect(store.saveToFile).not.toHaveBeenCalled()
    })
    it('拒绝匿名请求与普通用户修改配置', async () => {
        expect((await app.request('/admin/config/openmusic-auth', { method: 'PUT', body: '{"enabled":false}' })).status).toBe(401)
        store.users.set('config-test-admin', { role: 'user' })
        expect((await update(false)).status).toBe(403)
        expect(store.saveToFile).not.toHaveBeenCalled()
    })
})

describe('管理每日整体数据备份配置与轮转', () => {
    it('备份开关默认开启且支持通过后台接口关闭和开启', async () => {
        expect((await (await app.request('/admin/config', { headers })).json()).data.backupEnabled).toBe(true)
        for (const enabled of [false, true]) {
            const response = await updateBackup(enabled)
            expect(response.status).toBe(200)
            expect((await response.json()).data.backupEnabled).toBe(enabled)
            expect((await (await app.request('/admin/config', { headers })).json()).data.backupEnabled).toBe(enabled)
        }
        expect(store.saveToFile).toHaveBeenCalledTimes(2)
        expect(store.addLog).toHaveBeenCalledWith('config_update', expect.any(String), 'config-test-admin')
    })

    it('拒绝非布尔值与非管理员修改备份开关', async () => {
        for (const enabled of [undefined, null, 'true', 1, {}]) {
            expect((await updateBackup(enabled)).status).toBe(400)
            expect(store.getConfig().backupEnabled).toBe(true)
        }
        expect((await app.request('/admin/config/backup', { method: 'PUT', body: '{"enabled":false}' })).status).toBe(401)
        store.users.set('config-test-admin', { role: 'user' })
        expect((await updateBackup(false)).status).toBe(403)
        expect(store.saveToFile).not.toHaveBeenCalled()
    })

    it('每天将整体数据备份到目录下并在第二天备份时删除前一天的备份', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meting-backup-test-'))
        try {
            store.dataDir = tempDir
            fs.writeFileSync(path.join(tempDir, 'cookie-encryption.key'), Buffer.alloc(32, 7).toString('base64'))

            const day1Result = await store.performDailyBackup({ date: '2026-11-04' })
            expect(day1Result.success).toBe(true)
            const day1Dir = path.join(tempDir, 'backups', '2026-11-04')
            expect(fs.existsSync(day1Dir)).toBe(true)
            for (const fileName of [
                'cookies.json',
                'users.json',
                'logs.json',
                'security.json',
                'config.json',
                'monitor_logs.json',
                'api_logs.json',
                'api_tokens.json',
                'cookie-encryption.key',
            ]) {
                expect(fs.existsSync(path.join(day1Dir, fileName))).toBe(true)
            }

            const day2Result = await store.performDailyBackup({ date: '2026-11-05' })
            expect(day2Result.success).toBe(true)
            expect(day2Result.removedPrevious).toContain('2026-11-04')
            const day2Dir = path.join(tempDir, 'backups', '2026-11-05')
            expect(fs.existsSync(day2Dir)).toBe(true)
            expect(fs.existsSync(day1Dir)).toBe(false)
            expect(fs.readdirSync(path.join(tempDir, 'backups'))).toEqual(['2026-11-05'])

            store.config.backupEnabled = false
            const skippedResult = await store.performDailyBackup({ date: '2026-11-06' })
            expect(skippedResult).toMatchObject({ success: false, skipped: true, reason: 'disabled' })
            expect(fs.readdirSync(path.join(tempDir, 'backups'))).toEqual(['2026-11-05'])
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true })
        }
    })
})
