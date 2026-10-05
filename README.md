<div align="center">

# 🎵 OpenMusic-Meting-API

<p><strong>统一的多平台音乐 API 服务</strong></p>

<p>
  <a href="https://github.com/qq01-hub/Meting-API/stargazers"><img src="https://img.shields.io/github/stars/qq01-hub/Meting-API?style=flat-square&color=f59e0b" alt="Stars"></a>
  <a href="https://github.com/qq01-hub/Meting-API/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-10b981?style=flat-square" alt="MIT License"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%E2%89%A518-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js"></a>
  <a href="https://hub.docker.com/r/w3126197382/meting-api"><img src="https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker"></a>
</p>

<p>
  网易云音乐 · QQ 音乐 · 汽水音乐 · 酷狗音乐<br>
  Cookie 管理 · 会员音质 · 私人漫游 · 管理后台
</p>

<p>
  <a href="#-快速开始">快速开始</a> ·
  <a href="#-api-一览">API 一览</a> ·
  <a href="#-使用示例">使用示例</a> ·
  <a href="#-管理后台">管理后台</a> ·
  <a href="#-常见问题">FAQ</a>
</p>

</div>

> **OpenMusic-Meting-API** 是一个基于 Node.js 的多平台音乐 API 服务，提供歌曲、歌单、搜索、歌词、封面、播放地址和私人漫游等能力。

## ✨ 项目亮点

| 能力 | 说明 |
|:---|:---|
| 🎼 多平台聚合 | 统一接入网易云、QQ、汽水、酷狗音乐 |
| 🔍 丰富接口 | 支持歌曲、歌单、歌手、搜索、电台、歌词、封面与播放地址 |
| 🎧 音质选择 | 支持标准、极高、无损、Hi-Res、母带等多档音质 |
| 🌊 私人漫游 | 支持网易云、QQ、汽水和酷狗的推荐内容获取 |
| 🛠️ 管理后台 | Cookie 管理、扫码登录、自动续期、定时监测、Webhook、2FA 与多用户 |
| 🚀 灵活部署 | 支持 Node.js、Deno、Docker 与 Vercel 等部署方式 |

## 🚀 快速开始

### 环境要求

- Node.js `>= 18`
- npm

### 本地运行

```bash
git clone https://github.com/qq01-hub/Meting-API.git
cd Meting-API
npm install
npm run start:node
```

启动后可访问：

| 服务 | 地址 |
|:---|:---|
| API 文档 | [`http://localhost:3000`](http://localhost:3000) |
| 在线测试 | [`http://localhost:3000/test`](http://localhost:3000/test) |
| 管理后台 | [`http://localhost:3000/admin`](http://localhost:3000/admin) |

> 管理后台默认账号为 `admin` / `admin123`，首次登录后请立即修改密码。

### Docker 部署

```bash
docker run -d \
  --name openmusic-meting-api \
  -p 3000:3000 \
  -v ./data:/app/data \
  w3126197382/meting-api:latest
```

### [OpenMusic-Meting-Api 响度辅助服务](https://github.com/qq01-hub/OpenMusic-Meting-Api-Audio-Loudness)

OpenMusic-Meting-Api 是独立的音频响度分析辅助服务。

可在管理后台“监测设置”中配置服务地址。配置后，`type=url` 会分析标准音质响度，同时保留用户请求的实际音质；服务异常时继续使用平台返回值。

接口地址示例：

```bash
LOUDNESS_SERVICE_URL=http://localhost:3100/analyze
```

Docker 网络中可使用：`http://meting-api-audio-loudness:3100/analyze`

## 📡 API 一览

### 基础格式

```http
GET /api?server={平台}&type={类型}&id={资源}&quality={音质}
```

### 请求参数

| 参数 | 默认值 | 说明 |
|:---|:---:|:---|
| `server` | `netease` | `netease` · `tencent` · `qishui` · `kugou` |
| `type` | `playlist` | 接口类型，详见下方能力矩阵 |
| `id` | — | 歌曲 / 歌单 ID，或搜索关键词 / 漫游模式 |
| `quality` | `standard` | 播放地址接口（`type=url`）的音质参数 |
| `redirect` | — | 设置为 `1` 时，`url` / `pic` 通过 302 重定向返回 |

### 能力矩阵

| `type` | `id` | 网易云 | QQ | 汽水 | 酷狗 |
|:---|:---|:---:|:---:|:---:|:---:|
| `song` | 歌曲 ID | ✅ | ✅ | ✅ | ✅ |
| `playlist` | 歌单 ID | ✅ | ✅ | ✅ | ✅ |
| `artist` | 歌手 ID | ✅ | — | — | — |
| `search` | 歌曲关键词（歌名 / 歌手 / 专辑） | ✅ | ✅ | ✅ | ✅ |
| `search_playlist` | 歌单关键词（歌单名 / 创建者） | ✅ | ✅ | — | ✅ |
| `search_dj` | 电台关键词（节目 / 主播） | ✅ | — | — | — |
| `dj` / `dj_detail` / `djprogram` / `dj_hot` | 电台相关 | ✅ | — | — | — |
| `fm` | 私人漫游 | ✅ | ✅ | ✅ | ✅ |
| `url` / `lrc` / `pic` | 歌曲 ID | ✅ | ✅ | ✅ | ✅ |

### 私人漫游 `fm`

| 平台 | 支持模式 | 说明 |
|:---|:---|:---|
| 网易云 | `DEFAULT` · `FAMILIAR` · `EXPLORE` · `aidj` · `SCENE_RCMD[:子模式]` | 子模式：`EXERCISE` / `FOCUS` / `NIGHT_EMO` |
| QQ 音乐 | 不支持传模式 | 固定猜你喜欢，`id` 无效；需要登录 Cookie |
| 汽水音乐 | 可空 / 平台自有偏好 | 需要登录 Cookie |
| 酷狗音乐 | 平台自有偏好 | 以平台返回结果为准 |

> 播放地址请统一通过 `type=url` 再次请求获取。

管理员可在 Cookie 管理中为每个平台设置一个“FM 优先”账号。FM 返回的歌曲链接会带 `fm=1` 标记：若优先账号无法提供请求音质，播放地址仍使用该 FM 歌曲 ID，并自动改由其他具备对应会员权限的账号获取。请求带 `X-OpenMusic-Cookie` 时始终以请求头中的 Cookie 为准，不启用 FM 优先切换。

### 音质 `quality`

会员权限不足或曲目不提供对应档位时，接口会自动降级；响应中的 `quality` 为实际返回档位的中文名称。

| `quality` | 网易云 | QQ 音乐 | 汽水音乐 |
|:---|:---|:---|:---|
| `128` / `standard` | 标准 | 标准 | 标准 |
| `higher` | 较高 | — | — |
| `320` / `exhigh` | 极高 · VIP | HQ · VIP | 极高 · VIP |
| `flac` / `lossless` | 无损 · VIP | SQ · VIP | 无损 · SVIP |
| `studio` | — | — | 录音室 · SVIP |
| `hires` / `jyeffect` | Hi-Res / 臻音 · VIP | — | — |
| `sky` / `jymaster` / `dolby` | 环绕 / 母带 / 杜比 · SVIP | — | — |
| `atmos` | — | 臻品全景声 · 超会 | 全景 · SVIP |
| `master` | — | 臻品母带 · 超会 | — |
| `viper_atmos` / `atmos` | — | — | 蝰蛇全景声 2.0 · SVIP |
| `viper_tape` | — | — | 蝰蛇母带音质 · SVIP |
| `viper_clear` | — | — | 蝰蛇超清音质 · SVIP |
| `viper_hifi` | — | — | 蝰蛇 HiFi 音质 · SVIP |

> 汽水音乐：`studio` / `atmos` / `flac` / `lossless` 需要 SVIP，`320` / `exhigh` 需要 VIP。酷狗音乐：`320` / `flac` / `lossless` / `hires` 需要 VIP，蝰蛇音质需要 SVIP。QQ 音乐的“超会”对应文档中的 SVIP 档位。

## 🧪 使用示例

### 歌曲、歌单与搜索

```http
GET /api?server=netease&type=playlist&id=6907557348
GET /api?server=tencent&type=song&id=0010BrWk2SucQr
GET /api?server=qishui&type=search&id=风筝误
GET /api?server=kugou&type=search&id=情歌
GET /api?server=kugou&type=search_playlist&id=流行
GET /api?server=kugou&type=playlist&id=gcid_3zfpq2kyzmz04f
```

### 私人漫游

```http
GET /api?server=netease&type=fm&id=FAMILIAR
GET /api?server=tencent&type=fm
GET /api?server=qishui&type=fm
GET /api?server=kugou&type=fm
```

### 播放地址、歌词与封面

```http
GET /api?server=netease&type=url&id=254059&quality=lossless
GET /api?server=tencent&type=url&id=0010BrWk2SucQr&quality=master&redirect=1
GET /api?server=tencent&type=lrc&id=0010BrWk2SucQr
GET /api?server=kugou&type=url&id=72db6da75ffe23a3a6361bdb8f44d5f4&quality=flac
GET /api?server=kugou&type=url&id=72db6da75ffe23a3a6361bdb8f44d5f4&quality=master
GET /api?server=kugou&type=lrc&id=72db6da75ffe23a3a6361bdb8f44d5f4
GET /api?server=kugou&type=pic&id=72db6da75ffe23a3a6361bdb8f44d5f4
```

### 响应说明

- 曲目类接口：返回 JSON 数组，例如 `{ title, author, url, pic, lrc, ... }`
- `url`：返回 `{ url, quality, duration, loudness }`；设置 `redirect=1` 时返回 302
  - `duration`：音频时长，单位为秒，例如 `260` 即 4 分 20 秒
  - `loudness`：标准化响度信息。酷狗会将播放响应的 `volume` 映射为 `gain`、`volume_peak` 映射为 `peak`；平台未提供可用数据时为 `null`。
- `pic`：返回 302
- `lrc`：返回纯文本歌词

### MetingJS

```html
<script>
  var meting_api = 'https://你的域名/api?server=:server&type=:type&id=:id&auth=:auth&r=:r&redirect=1'
</script>
```

## 🛠️ 管理后台

访问 `/{ADMIN_PATH}`，可使用以下功能：

- Cookie 增删与有效性验证
- QQ 音乐自动续期
- 汽水音乐扫码登录
- 酷狗扫码登录与 API 凭证管理
- 定时监测与 Webhook
- 2FA 与多用户管理

### Cookie 配置要点

| 平台 | 配置建议 |
|:---|:---|
| 网易云音乐 | 在浏览器中复制完整 Cookie |
| QQ 音乐 | 至少包含 `uin` + `qqmusic_key`；包含 `psrf_qqrefresh_token` 可自动续期 |
| 汽水音乐 | 需要 `sessionid` 等登录字段；无公开 refresh，过期后重新扫码 |
| 酷狗音乐 | 推荐使用后台“酷狗扫码登录”；手动添加时需同时包含 `token` 与 `userid` |

管理 API 认证头：

```http
X-Auth-Username: <username>
X-Auth-Token: <token>
```

## ❓ 常见问题

<details>
<summary><strong>高音质为什么被降级？</strong></summary>

Cookie 的会员等级不足，或曲目本身没有对应档位。请查看响应中的 `quality` 字段。

</details>

<details>
<summary><strong>QQ 音乐无法播放怎么办？</strong></summary>

请确认客户端能够访问国内音源，并检查 VIP Cookie 是否有效；建议尽量携带 `refresh_token`。

</details>

<details>
<summary><strong>Cookie 刷新失败怎么办？</strong></summary>

Cookie 可能已经彻底过期（约 90 天），请重新登录或扫码获取。

</details>

<details>
<summary><strong>忘记管理后台路径怎么办？</strong></summary>

查看 `DATA_DIR/config.json` 中的 `adminPath`，或通过环境变量 `ADMIN_PATH` 自定义路径。

</details>

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

<div align="center">
  <sub>OpenMusic-Meting-API · 让音乐接口接入更简单</sub>
</div>
