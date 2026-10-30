import { expect, it } from 'vitest'
import { adminPageHandler } from './page.js'

it('shows each Cookie URL failure count in the admin list', () => {
    const html = adminPageHandler({ html: value => value })
    expect(html).toContain('URL 获取失败：')
    expect(html).toContain('cookie.urlErrorCount || 0')
    expect(html).toContain('cookie.tencentSliderCount || 0')
    expect(html).toContain('slider-error-count')
})

it('shows interface log categories and error codes', () => {
    const html = adminPageHandler({ html: value => value })
    expect(html).toContain('<th>分类</th>')
    expect(html).toContain('url_failover')
    expect(html).toContain('(log.code || \'-\')')
})

it('renders a Tencent verification prompt in Cookie management', () => {
    const html = adminPageHandler({ html: value => value })
    expect(html).toContain('id="tencentVerifyBanner"')
    expect(html).toContain('id="tencentVerifyModal"')
    expect(html).toContain('id="tencentVerifyImage"')
    expect(html).toContain('id="tencentVerifyRetry"')
    expect(html).not.toContain('旧记录未保存歌曲 ID')
    expect(html).toContain('id="tencentVerifyAccountSelect"')
    expect(html).toContain('id="tencentVerifyAccount"')
    expect(html).toContain('id="tencentVerifyIdentity"')
    expect(html).toContain('id="tencentVerifyCooldown"')
    expect(html).toContain('id="tencentVerifyModalAccount"')
    expect(html).not.toContain('id="tencentVerifyLink"')
})

it('keeps the Qishui verification iframe same-origin and capable for the official SDK', () => {
    // opaque origin 会让 bdms.js 的 localStorage / document.cookie 访问抛 SecurityError，
    // 也会让桥接请求拼出 "null/admin/…" 的相对地址，二次验证无法开始或提交。
    const html = adminPageHandler({ html: value => value })
    expect(html).toContain('id="qrVerifyIframe"')
    const sandbox = html.match(/<iframe id="qrVerifyIframe"[^>]*sandbox="([^"]*)"/)?.[1] || ''
    for (const token of ['allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-popups', 'allow-popups-to-escape-sandbox']) {
        expect(sandbox.split(/\s+/)).toContain(token)
    }
    expect(html).not.toContain('sandbox="allow-scripts"></iframe>')
})
