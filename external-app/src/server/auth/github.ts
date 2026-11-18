import 'server-only'
import { User, type GitHubTokens } from '../models/user'
import { getSession } from './session'

export function getGitHubAuthorizationUrl(
  redirectUri: string,
  state: string,
  codeChallenge: string
): string {
  const clientId = process.env.GITHUB_CLIENT_ID

  if (!clientId) {
    throw new Error('缺少 GITHUB_CLIENT_ID')
  }

  const url = new URL('https://github.com/login/oauth/authorize')

  url.search = new URLSearchParams({
    client_id: clientId, // 必需参数，从 GitHub 应用设置里获取
    redirect_uri: redirectUri,
    prompt: 'select_account', // 每次都弹出账户选择器，没有prompt的话，登录过的用户会直接授权成功，当然也是会走其他流程，只是github的前端不展示了
    scope: 'read:user user:email offline_access', // 访问权限范围
    state, // 随机字符串，用于防 CSRF，这个参数会被github原样返回，必须是state名称。校验工作完全由三方应用自己完成
    code_challenge: codeChallenge, // pkce challenge码
    code_challenge_method: 'S256'
  }).toString()

  return url.toString()
}

export function validateGitHubIssuer(iss: string | null): void {
  if (iss !== 'https://github.com/login/oauth') {
    throw new Error('GitHub 授权服务器校验失败')
  }
}

export async function getGitHubIdentity(
  code: string,
  redirectUri: string,
  iss: string | null,
  codeVerifier: string
) {
  // 校验来源
  validateGitHubIssuer(iss)

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('缺少 GITHUB_CLIENT_ID 或 GITHUB_CLIENT_SECRET')
  }

  const requestedAt = Date.now()

  // 获取oauth的访问令牌
  const tokenResponse = await fetch(
    'https://github.com/login/oauth/access_token',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        // 在上面授权的时候，会将code和code_challenge进行绑定，现在github会通过code_verifier+code，去重新生成code_challenge比较是否一致
        code_verifier: codeVerifier
      }),
      cache: 'no-store',
      // 避免携带 client_secret 的请求被自动重定向。
      redirect: 'error'
    }
  )

  if (!tokenResponse.ok) {
    throw new Error(`GitHub 授权码交换失败，HTTP ${tokenResponse.status}`)
  }

  /**
   * token的数据结构：
   *  {
        access_token: xxx,
        expires_in: 28800,
        refresh_token: xxx,
        refresh_token_expires_in: 15638400,
        token_type: 'bearer',
        scope: 'read:user,user:email'
      }
   */
  const token = await tokenResponse.json()

  const githubTokens: GitHubTokens = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    accessTokenExpiresAt: requestedAt + token.expires_in * 1000,
    refreshTokenExpiresAt: requestedAt + token.refresh_token_expires_in * 1000
  }

  // 由于github sso不是oidc，需要通用单独调用用户接口获取用户信息
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token.access_token}`
    }
  })

  if (!userResponse.ok) {
    throw new Error(`获取 GitHub 用户信息失败，HTTP ${userResponse.status}`)
  }

  // user包含：id、login（username）、avatar_url，和https://api.github.com/users/xiaotianna这个网站返回的一样
  const user = await userResponse.json()

  return {
    providerUserId: String(user.id),
    username: user.name || user.login,
    avatarUrl: user.avatar_url,
    githubTokens
  }
}

export async function refreshGitHubTokens(
  refreshToken: string
): Promise<GitHubTokens> {
  const requestedAt = Date.now()

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      client_secret: process.env.GITHUB_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  })

  const token = await response.json()

  if (!response.ok || token?.error) {
    throw new Error(
      token?.error === 'bad_refresh_token'
        ? 'GitHub 授权已失效，请重新授权'
        : '刷新 GitHub token 失败'
    )
  }

  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    accessTokenExpiresAt: requestedAt + token.expires_in * 1000,
    refreshTokenExpiresAt: requestedAt + token.refresh_token_expires_in * 1000
  }
}

export async function getGitHubProfile() {
  const session = await getSession()

  if (!session) {
    return null
  }

  const user = await User.findByPk(session.userId)
  if (!user?.githubTokens?.accessToken) return null

  let tokens = user.githubTokens

  let response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`
    },
    cache: 'no-store',
    redirect: 'error'
  })

  if (response.status === 401) {
    // 过期请求刷新token
    tokens = await refreshGitHubTokens(tokens.refreshToken)
    await user.update({ githubTokens: tokens })

    // 重新请求user
    response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`
      },
      cache: 'no-store',
      redirect: 'error'
    })
  }

  if (response.status === 401) {
    throw new Error('GitHub 认证仍失败，请重新授权')
  }

  if (!response.ok) {
    throw new Error(`GitHub API 请求失败：${response.status}`)
  }

  return response.json()
}
