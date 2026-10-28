# OpenMusic 服务端授权

音乐入口 `/api`、`/test`、`/admin/openmusic`、`/admin/fm` 和 `/audio/qishui` 默认同时要求 API Token 与 OpenMusic 服务端短期签名，裸请求或仅 `Authorization: Bearer` 请求均不能获取音乐响应

## 授权开关

管理员可在管理后台的「设置 → OpenMusic 授权」中开启或关闭「启用 OpenMusic 授权校验」，保存后立即生效，无需重启

- 配置字段为 `openmusicAuthEnabled`，默认开启，旧配置未包含此字段时仍按开启处理
- 开启时保留完整的断言、签名、时效及 nonce 防重放校验
- 关闭时不要求或校验 `X-OpenMusic-Assertion`、`X-OpenMusic-Signature`，即使携带无效值也会忽略，但仍必须提供有效的 `Authorization: Bearer <API Token>`，不开放匿名访问
- 开关统一作用于所有使用 API Token 的程序化入口，包括音乐、汽水音频和管理接口，管理员独立会话登录不受影响，请仅在可信环境中关闭
- 配置通过 `PUT /admin/config/openmusic-auth` 保存，请求体为 `{"enabled":false}` 或 `{"enabled":true}`，沿用管理接口鉴权规则
- 设置保存到数据目录的 `config.json`，重启后保留

## 接入

1. 在 Meting 管理后台创建或轮换 API Token
2. 在 OpenMusic 管理后台配置对应 Meting 地址和 Token，不要把 Token 写入网页、URL、前端代码或浏览器存储
3. 先升级 OpenMusic 服务端使其发送附加签名，再升级 Meting，最后验证已登录 OpenMusic 的搜索、播放与汽水本地解密流程
4. 签名头只在服务端发送，不支持浏览器以任意账户 ID 自行申请音乐凭证

## 协议

- `X-OpenMusic-Assertion` 为 base64url 编码的 JSON，包含 `v=1`、`sub`、`purpose`、秒级 `ts` 和 18 随机字节的 base64url `nonce`
- `purpose=account` 时 `sub` 必须为 OpenMusic 账户 ID，`purpose=system` 仅供受信任的健康探测、房间漫游等内部任务
- 签名为使用对应 API Token 计算的 HMAC-SHA256，输入按换行连接 assertion 原文、大写方法、原始路径及查询参数、请求体 SHA256 十六进制摘要
- 使用 `X-OpenMusic-Signature` 传递 base64url 签名，两端时钟误差不超过 60 秒，代理不能改写参与签名的路径和查询参数
- 无签名或验证失败返回 `401 OPENMUSIC_AUTH_REQUIRED`，重复 nonce 返回 `401 OPENMUSIC_REPLAY`，当前重放存储满时返回 `503 OPENMUSIC_AUTH_BUSY`
- 重放存储只在当前进程内有效，最多 100000 条并保留两个时间窗，多实例扩容前需要共享重放存储，不能宣称跨实例全局防重放
- 音乐响应禁止公共缓存，HTTP 日志只记录方法、路径与状态，不记录查询参数中的播放 token
- 程序化写请求在读取请求体前先拒绝缺少签名头的调用，请求体按实际流量限制为 1 MiB，读取时限为 10 秒，超限返回 `413 REQUEST_BODY_TOO_LARGE`，超时返回 `408 REQUEST_BODY_TIMEOUT`
- 所有程序化响应在处理结束后强制 `Cache-Control: no-store, private`，媒体响应和错误也不能恢复缓存，日志隐藏管理路径与未知路径，音乐取链和漫游错误不回传上游异常文本

## 汽水代理边界

播放 token 不是独立授权凭证，音频与 `mode=source` 同样必须通过 API Token，授权开关开启时还需短期签名

汽水源地址只接受无用户信息、无非默认端口、无 fragment 的 HTTPS `*.douyinvod.com` 地址，禁止任意域名、IP 字面量与自动重定向，地址在创建播放 token、读取缓存及返回源地址前重新校验，单次下载时限 60 秒、最大 128 MiB

这是收紧后的 CDN 白名单，不保证其他区域或未来新增 CDN 域名兼容，新增域名需先核验归属后显式维护白名单，不能为恢复播放放开任意 URL 或重定向，本地未使用真实音乐账户或 CDN 做兼容验证

白名单不是 DNS 固定解析或出站防火墙，部署仍需阻断内网、链路本地与云元数据目的地址，并防止受信域名被内部 DNS 重写

所有使用 Bearer 的程序化入口，包括 Cookie 池、扫码、取链和 Token 管理接口，在授权开关开启时统一要求 OpenMusic 短期断言，不能仅凭裸 Bearer 借管理路径调用音乐服务或获取凭据

管理员通过用户名与会话 Token 登录管理后台的独立方式保留，注销必须先通过认证且仅使用已认证身份，不能匿名指定其他用户名使其下线

## 风险与发布

Meting 信任 OpenMusic 服务端签名，实际登录状态、账户额度、IP 风控与人工限制由 OpenMusic 校验，签名不替代账户登录，也不能抵御 API Token 泄露后的伪造，历史 Token 如已泄露必须轮换

新版 OpenMusic 对未登录请求不下发业务签名密钥，已登录的入站请求按账户与 IP 原子限额，注销后新请求拒绝，人工限制账户仅音乐 URL 取链由 OpenMusic 强制替换为指定曲目，其他业务拒绝

端口只绑定回环地址或容器私网，管理使用 SSH 隧道或独立受控入口，移除公网直接访问 Meting 的反代与端口映射，签名不是防火墙的替代品

升级代码后需要重启 Meting，后续切换授权开关无需重启，不变更现有 Cookie 文件，API 示例仅表示参数格式，不意味着匿名可用，旧客户端建议升级，确需兼容仅 Bearer 的客户端时可在可信环境中关闭 OpenMusic 授权校验

回滚时必须与 OpenMusic 配套，旧版不签名的 OpenMusic 无法对接授权开关开启的 Meting，不能删除用户 Cookie 或管理数据来尝试恢复，完整运营说明见 OpenMusic 的 `docs/ACCOUNT_RISK_CONTROL.md`
