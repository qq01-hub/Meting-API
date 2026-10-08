import { expect, it } from 'vitest'
import { adminPageHandler } from './page.js'

it('shows each Cookie URL failure count in the admin list', () => {
    const html = adminPageHandler({ html: value => value })
    expect(html).toContain('URL 获取失败：')
    expect(html).toContain('cookie.urlErrorCount || 0')
    expect(html).toContain('cookie.tencentSliderCount || 0')
    expect(html).toContain('slider-error-count')
})

it('renders a Tencent verification prompt in Cookie management', () => {
    const html = adminPageHandler({ html: value => value })
    expect(html).toContain('id="tencentVerifyBanner"')
    expect(html).toContain('id="tencentVerifyModal"')
    expect(html).toContain('id="tencentVerifyImage"')
    expect(html).toContain('id="tencentVerifyRetry"')
    expect(html).toContain('id="tencentVerifySongmid"')
    expect(html).toContain('id="tencentVerifyAccountSelect"')
    expect(html).toContain('id="tencentVerifyAccount"')
    expect(html).toContain('id="tencentVerifyIdentity"')
    expect(html).toContain('id="tencentVerifyCooldown"')
    expect(html).toContain('id="tencentVerifyModalAccount"')
    expect(html).not.toContain('id="tencentVerifyLink"')
})
