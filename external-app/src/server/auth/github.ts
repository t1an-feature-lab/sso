export function getGitHubAuthorizationUrl(
  redirectUri: string,
  state: string
): string {
  const clientId = process.env.GITHUB_CLIENT_ID

  if (!clientId) {
    throw new Error('缺少 GITHUB_CLIENT_ID')
  }

  const url = new URL('https://github.com/login/oauth/authorize')

  url.search = new URLSearchParams({
    client_id: clientId, // 必需参数，从 GitHub 应用设置里获取
    redirect_uri: redirectUri,
    scope: 'read:user user:email', // 访问权限范围
    state // 随机字符串，用于防 CSRF，这个参数会被github原样返回，必须是state名称。校验工作完全由三方应用自己完成
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
  iss: string | null
) {
  // 校验来源
  validateGitHubIssuer(iss)

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('缺少 GITHUB_CLIENT_ID 或 GITHUB_CLIENT_SECRET')
  }

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
        redirect_uri: redirectUri
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
    avatarUrl: user.avatar_url
  }
}
