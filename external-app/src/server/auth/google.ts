import 'server-only'
import { User, type GoogleTokens } from '../models/user'
import { getSession } from './session'
import { createRemoteJWKSet, jwtVerify } from 'jose'

export function getGoogleAuthorizationUrl(
  redirectUri: string,
  state: string,
  codeChallenge: string,
  nonce: string
): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('缺少 GOOGLE_CLIENT_ID')

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')

  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    state, // 防止csrf
    nonce, // 与id token相关，防重放
    code_challenge: codeChallenge, // pkce challenge码
    code_challenge_method: 'S256',
    access_type: 'offline', // 只有当声明为offline后，code换令牌的过程才会返回refresh_token，github会默认返回
    prompt: 'consent select_account' // 用户已经授权过时，之后的登录默认不再返回 refresh_token，需要 prompt=consent
  }).toString()

  return url.toString()
}

export function validateGoogleIssuer(iss: string | null): void {
  if (iss !== 'https://accounts.google.com') {
    throw new Error('Google 授权服务器校验失败')
  }
}

export async function getGoogleIdentity(
  code: string,
  redirectUri: string,
  iss: string | null,
  codeVerifier: string,
  nonce: string
) {
  validateGoogleIssuer(iss)

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('缺少 GOOGLE_CLIENT_ID 或 GOOGLE_CLIENT_SECRET')
  }

  const requestedAt = Date.now()

  // 和github的步骤类似
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      // 因为accesss token和refresh token是使用同一个接口。
      // 按照谷歌文档要求，表示换access token
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier
    }),
    cache: 'no-store',
    redirect: 'error'
  })

  if (!tokenResponse.ok) {
    throw new Error(`Google 授权码交换失败，HTTP ${tokenResponse.status}`)
  }

  /**
   * token的数据结构：和github的类似，只是多了id_token
   *  {
        access_token: 'xxx',
        expires_in: 3599,
        scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email openid',
        token_type: 'Bearer',
        id_token: 'xxx',
        refresh_token: 'xxx' // access_type为offline时才返回
      }
   */
  const token = await tokenResponse.json()

  // 发现文档中 jwks_uri 指定的公钥地址，使用非对称签名，公钥只是负责验签
  const googleKeys = createRemoteJWKSet(
    new URL('https://www.googleapis.com/oauth2/v3/certs')
  )

  // 这些ts类型是谷歌文档中对于id token包含字段的声明（也就是jwt的payload参数）
  const { payload: user } = await jwtVerify<{
    sub: string
    nonce: string
    name?: string
    picture?: string
  }>(token.id_token, googleKeys, {
    // id token参数参考：https://developers.google.com/identity/openid-connect/openid-connect?hl=zh-cn#validatinganidtoken
    algorithms: ['RS256'],
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientId,
    requiredClaims: ['sub', 'exp', 'iat', 'nonce']
  })

  if (user.nonce !== nonce) {
    throw new Error('Google ID token 校验失败')
  }

  return {
    providerUserId: user.sub,
    username: user.name || user.sub,
    avatarUrl: user.picture || null,
    googleTokens: {
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      accessTokenExpiresAt: requestedAt + token.expires_in * 1000
    }
  }
}

export async function refreshGoogleTokens(
  refreshToken: string
): Promise<GoogleTokens> {
  const requestedAt = Date.now()

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token', // 【OAuth 2.0 规范】
      refresh_token: refreshToken
    }),
    cache: 'no-store',
    redirect: 'error'
  })

  const token = await response.json()

  if (!response.ok || token?.error) {
    throw new Error(
      token?.error === 'invalid_grant'
        ? 'Google 授权已失效，请重新授权'
        : '刷新 Google token 失败'
    )
  }

  return {
    accessToken: token.access_token,
    // Google 未返回新的 refresh token 时，继续保存旧值
    refreshToken: token.refresh_token ?? refreshToken,
    accessTokenExpiresAt: requestedAt + token.expires_in * 1000
  }
}

export async function getGoogleProfile() {
  const session = await getSession()

  if (!session) {
    return null
  }

  const user = await User.findByPk(session.userId)
  if (!user?.googleTokens?.accessToken) return null

  let tokens = user.googleTokens

  let response = await fetch(
    'https://openidconnect.googleapis.com/v1/userinfo',
    {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`
      },
      cache: 'no-store',
      redirect: 'error'
    }
  )

  if (response.status === 401) {
    if (!tokens.refreshToken) {
      throw new Error('请重新授权 Google，以获取刷新令牌')
    }

    // 过期请求刷新token
    tokens = await refreshGoogleTokens(tokens.refreshToken)
    await user.update({ googleTokens: tokens })

    response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`
      },
      cache: 'no-store',
      redirect: 'error'
    })
  }

  if (response.status === 401) {
    throw new Error('Google 认证仍失败，请重新授权')
  }

  if (!response.ok) {
    throw new Error(`Google UserInfo 请求失败：${response.status}`)
  }

  const profile = await response.json()

  // 【OIDC 规范】必须与登录时验证过的 ID token 的 sub 一致
  if (profile.sub !== user.providerUserId) {
    throw new Error('Google 用户身份不匹配')
  }

  return profile
}
