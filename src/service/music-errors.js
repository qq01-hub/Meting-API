export const isMusicAccountInvalid = (error, platform) => {
    if (error?.code === 'MUSIC_ACCOUNT_INVALID') return true
    if (Number(error?.status) === 401) return true
    if (platform === 'netease' && Number(error?.code || error?.body?.code) === 301) return true
    if (platform === 'kugou' && Number(error?.code || error?.error_code) === 35005) return true
    const message = [error?.message, error?.msg, error?.error, error?.body?.message, error?.payload?.errmsg, error?.payload?.msg]
        .filter(value => typeof value === 'string').join(' ')
    return /登录态.*(?:无效|过期)|登录.*(?:失效|过期)|未登录|需要登录|请.*登录|(?:cookie|token).*(?:无效|失效|过期)|not logged in|login required|need login|(?:cookie|session|token).*(?:expired|invalid)/iu.test(message)
}

export const musicFailure = (error, platform) => {
    if (isMusicAccountInvalid(error, platform)) {
        return { status: 422, success: false, code: 'MUSIC_ACCOUNT_INVALID', error: '账号已无法使用，请重新登录' }
    }
    const timeout = ['TimeoutError', 'AbortError'].includes(error?.name)
        || ['ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(error?.code)
        || /timeout|超时/iu.test(String(error?.message || ''))
    return {
        status: timeout ? 504 : 502,
        success: false,
        code: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_REQUEST_FAILED',
        error: timeout ? '音源上游请求超时，请稍后重试' : '音源上游请求失败，请稍后重试',
    }
}
