import { get_runtime } from "./util.js"

let OVERSEAS = globalThis?.Deno?.env?.get("OVERSEAS") || globalThis?.process?.env?.OVERSEAS
const runtime = get_runtime()

if (['cloudflare', 'vercel'].includes(runtime)) OVERSEAS = true

const PORT = globalThis?.Deno?.env?.get("PORT") || globalThis?.process?.env?.PORT || 3000

const LOUDNESS_SERVICE_URL = (
    globalThis?.Deno?.env?.get("LOUDNESS_SERVICE_URL")
    || globalThis?.process?.env?.LOUDNESS_SERVICE_URL
    || ''
).trim()

const ADMIN_PATH = globalThis?.Deno?.env?.get("ADMIN_PATH") || globalThis?.process?.env?.ADMIN_PATH || 'admin'

const adminPath = ADMIN_PATH.replace(/^\/+|\/+$/g, '')

const ADMIN_USERNAME = (
    globalThis?.Deno?.env?.get("ADMIN_USERNAME")
    || globalThis?.process?.env?.ADMIN_USERNAME
    || 'admin'
).trim() || 'admin'

const ADMIN_PASSWORD =
    globalThis?.Deno?.env?.get("ADMIN_PASSWORD")
    || globalThis?.process?.env?.ADMIN_PASSWORD
    || 'admin123'

OVERSEAS = Boolean(OVERSEAS)

export default {
    OVERSEAS,
    PORT,
    LOUDNESS_SERVICE_URL,
    ADMIN_PATH: adminPath,
    ADMIN_USERNAME,
    ADMIN_PASSWORD,
}
