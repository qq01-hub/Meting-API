import crypto from 'crypto-browserify'
import { Buffer } from 'buffer'

// 对齐 KuGouMusicApi 5d6c9f7 的 register_dev 和 playlistAesEncrypt 协议
const PUBLIC_KEYS = {
  standard: '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDIAG7QOELSYoIJvTFJhMpe1s/gbjDJX51HBNnEl5HXqTW6lQ7LC8jr9fWZTwusknp+sVGzwd40MwP6U5yDE27M/X1+UR4tvOGOqp94TJtQ1EPnWGWXngpeIW5GxoQGao1rmYWAu6oi1z9XkChrsUdC6DJE5E221wf/4WLFxwAtRQIDAQAB\n-----END PUBLIC KEY-----',
  lite: '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDECi0Np2UR87scwrvTr72L6oO01rBbbBPriSDFPxr3Z5syug0O24QyQO8bg27+0+4kBzTBTBOZ/WWU0WryL1JSXRTXLgFVxtzIY41Pe7lPOgsfTCn5kZcvKhYKJesKnnJDNr5/abvTGf+rHG3YRwsCHcQ08/q6ifSioBszvb3QiwIDAQAB\n-----END PUBLIC KEY-----',
}
const text = (value) => String(value ?? '').trim()
const md5 = (value) => crypto.createHash('md5').update(value).digest('hex')
let defaultGuid
const fingerprints = new Map()
const CACHE_TTL = 6 * 60 * 60 * 1000
const CACHE_LIMIT = 128
const hasDfid = (cookie) => Boolean(text(cookie.dfid || cookie.kg_dfid).replace(/^-$/, ''))
const cacheKey = (cookie, profile) => `${profile.name}:${cookie.KUGOU_API_MID}:${text(cookie.userid)}:${md5(text(cookie.token))}`

const withDfid = (cookie, dfid) => ({
  ...cookie,
  dfid,
  // 同步原始 Cookie，避免请求头和已签名的查询参数使用不同设备指纹
  __raw: text(cookie.__raw)
    ? cookie.__raw.split(';').filter((part) => !/^\s*(?:dfid|kg_dfid)\s*=/.test(part)).concat(`dfid=${dfid}`).join('; ')
    : '',
})

export const prepareKugouAudioCookie = (cookie, profile) => {
  const guid = text(cookie.KUGOU_API_GUID) || (defaultGuid ||= md5(crypto.randomBytes(16)))
  const mid = text(cookie.KUGOU_API_MID || cookie.mid || cookie.kg_mid)
  const prepared = {
    ...cookie,
    KUGOU_API_GUID: guid,
    KUGOU_API_MID: mid && mid !== '0' ? mid : BigInt(`0x${md5(guid)}`).toString(),
  }
  const cached = fingerprints.get(cacheKey(prepared, profile))
  return !hasDfid(prepared) && cached?.dfid && cached.expiresAt > Date.now()
    ? withDfid(prepared, cached.dfid)
    : prepared
}

export const registerKugouDevice = async (cookie, profile, request) => {
  if (hasDfid(cookie)) return cookie
  const id = cacheKey(cookie, profile)
  const cached = fingerprints.get(id)
  if (cached?.expiresAt > Date.now()) {
    return withDfid(cookie, cached.dfid || await cached.pending)
  }
  const entry = { expiresAt: Date.now() + CACHE_TTL }
  entry.pending = (async () => {
    const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
    const seed = [...crypto.randomBytes(6)].map((value) => alphabet[value % alphabet.length]).join('')
    const digest = md5(seed)
    const aesKey = Buffer.from(digest.slice(0, 16))
    const iv = Buffer.from(digest.slice(16))
    const guid = cookie.KUGOU_API_GUID
    const payload = {
      availableRamSize: 4983533568, availableRomSize: 48114719, availableSDSize: 48114717,
      basebandVer: '', batteryLevel: 100, batteryStatus: 3, brand: 'Redmi',
      buildSerial: 'unknown', device: 'marble', imei: guid, imsi: '',
      manufacturer: 'Xiaomi', uuid: guid,
      accelerometer: false, accelerometerValue: '', gravity: false, gravityValue: '',
      gyroscope: false, gyroscopeValue: '', light: false, lightValue: '',
      magnetic: false, magneticValue: '', orientation: false, orientationValue: '',
      pressure: false, pressureValue: '', step_counter: false, step_counterValue: '',
      temperature: false, temperatureValue: '',
    }
    const cipher = crypto.createCipheriv('aes-128-cbc', aesKey, iv)
    const body = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]).toString('base64')
    const portrait = JSON.stringify({ aes: seed, uid: cookie.userid || 0, token: cookie.token || '' })
    const p = crypto.publicEncrypt({ key: PUBLIC_KEYS[profile.name], padding: 1 }, Buffer.from(portrait)).toString('hex')
    const encrypted = await request('/risk/v3/r_register_dev', {
      base: 'https://userservice.kugou.com', method: 'POST',
      params: { part: 1, platid: 1, p }, body, cookie, profile, responseType: 'arraybuffer', timeoutMs: 10_000,
    })
    const decipher = crypto.createDecipheriv('aes-128-cbc', aesKey, iv)
    const result = JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted)), decipher.final()]).toString('utf8'))
    const dfid = typeof result?.data?.dfid === 'string' ? text(result.data.dfid) : ''
    if (Number(result?.status) !== 1 || !dfid || dfid === '-') throw new Error('酷狗设备注册未返回有效 dfid')
    return dfid
  })()
  if (fingerprints.size >= CACHE_LIMIT) fingerprints.delete(fingerprints.keys().next().value)
  fingerprints.set(id, entry)
  try {
    entry.dfid = await entry.pending
    return withDfid(cookie, entry.dfid)
  } catch (error) {
    if (fingerprints.get(id) === entry) fingerprints.delete(id)
    throw error
  } finally {
    delete entry.pending
  }
}
