import { Provider } from '@/common/provider'
import { createHash, randomBytes } from 'node:crypto'
import { getGitHubAuthorizationUrl, getGitHubIdentity } from './github'
import { getGoogleAuthorizationUrl, getGoogleIdentity } from './google'
import { cookies } from 'next/headers'
import { findOrCreateUser } from './users'
import { createSession } from './session'
import { GitHubTokens, GoogleTokens } from '../models/user'

type AuthorizationUrlGetter = (
  redirectUri: string,
  state: string,
  codeChallenge: string,
  nonce: string
) => string

const providerAuthorizationUrl: Record<Provider, AuthorizationUrlGetter> = {
  github: getGitHubAuthorizationUrl,
  google: getGoogleAuthorizationUrl
}

export async function beginLogin(provider: Provider): Promise<string> {
  const appUrl = process.env.APP_URL

  if (!appUrl) {
    throw new Error('缺少 APP_URL')
  }

  // node:crypto 导入的 randomBytes 生成 32 个字节的密码学安全随机数
  const state = randomBytes(32).toString('base64url')
  // 针对oidc使用，关联登录请求与 id_token，防止重放
  const nonce = randomBytes(32).toString('base64url')
  // 服务器每次登录生成的随机字符串，临时保存到 Cookie，等回调兑换 token 时再用
  const codeVerifier = randomBytes(32).toString('base64url')
  // 对 verifier 做 SHA-256，再做 Base64URL 编码的结果，发给 GitHub。后续github生成的code会和codeChallenge进行绑定
  // 和state不同，github不会原样返回
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  const redirectUri = new URL(
    `/api/auth/${provider}/callback`,
    appUrl
  ).toString()

  // 例如provider是github，返回：https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}scope=read:user%20user:email&state=${state}
  const authorizationUrl = providerAuthorizationUrl[provider](
    redirectUri,
    state,
    codeChallenge,
    nonce
  )

  const cookieStore = await cookies()
  const secure = process.env.NODE_ENV === 'production'
  const cookieName = `${secure ? '__Host-' : ''}oauth_state`

  cookieStore.set(
    cookieName,
    JSON.stringify({ provider, state, codeVerifier, nonce }), // 存储自定义数据，方便校验state
    {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 600
    }
  )

  return authorizationUrl
}

type LoginCallbackParams = {
  code: string | null
  state: string | null
  iss: string | null
  error: string | null
}

type IdentityGetter = (
  code: string,
  redirectUrl: string,
  iss: string | null,
  codeVerifier: string,
  nonce: string
) => Promise<{
  providerUserId: string
  username: string
  avatarUrl: string | null
  githubTokens?: GitHubTokens
  googleTokens?: GoogleTokens
}>

const providerIdentityGetter: Record<Provider, IdentityGetter> = {
  github: getGitHubIdentity,
  google: getGoogleIdentity
}

export async function finishLogin(
  provider: Provider,
  callbackParams: LoginCallbackParams
): Promise<string> {
  const appUrl = process.env.APP_URL

  if (!appUrl) {
    throw new Error('缺少 APP_URL')
  }

  // 第三方授权的回调地址：换 token 使用的 redirectUri 必须与发起登录时一致。
  const redirectUri = new URL(
    `/api/auth/${provider}/callback`,
    appUrl
  ).toString()

  const { code, state, iss, error } = callbackParams

  // 获取cookie的值，主要是对比state
  const cookieStore = await cookies()
  const secure = process.env.NODE_ENV === 'production'
  const cookieName = `${secure ? '__Host-' : ''}oauth_state`
  const rawCookie = cookieStore.get(cookieName)?.value

  if (!rawCookie || !state) {
    throw new Error('登录请求已失效，请重新发起登录')
  }

  // Cookie 来自浏览器，解析结果需要先检查结构。
  let saved: unknown

  try {
    saved = JSON.parse(rawCookie)
  } catch {
    throw new Error('登录凭据格式无效，请重新发起登录')
  }

  if (
    typeof saved !== 'object' ||
    saved === null ||
    !('state' in saved) ||
    saved.state !== state ||
    !('codeVerifier' in saved) ||
    !('nonce' in saved)
  ) {
    throw new Error('登录状态校验失败，请重新发起登录')
  }

  // 清理 __Host- cookie 时，同样需要 secure 和 path: '/'。
  cookieStore.set(cookieName, '', {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  })

  if (error !== null) {
    throw new Error('第三方授权失败或已取消，请重新发起登录')
  }

  if (!code) {
    throw new Error('缺少授权码，请重新发起登录')
  }

  const codeVerifier = saved.codeVerifier as string
  const nonce = saved.nonce as string

  const identity = await providerIdentityGetter[provider](
    code,
    redirectUri,
    iss,
    codeVerifier,
    nonce
  )

  const user = await findOrCreateUser(provider, identity)

  // 确保本站会话已建立，再返回成功跳转地址
  await createSession(user.id)

  // 本站登录成功后的跳转地址
  const loginRedirectUrl = new URL('/', appUrl).toString()
  return loginRedirectUrl
}
