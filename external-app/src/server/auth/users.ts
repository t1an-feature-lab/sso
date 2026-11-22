import type { Provider } from '@/common/provider'
import { GitHubTokens, GoogleTokens, User } from '../models/user'
import { getSession } from './session'

type ProviderIdentity = {
  providerUserId: string
  username: string
  avatarUrl: string | null
  githubTokens?: GitHubTokens
  googleTokens?: GoogleTokens
}

export async function findOrCreateUser(
  provider: Provider,
  userInfo: ProviderIdentity
) {
  const {
    providerUserId,
    username,
    avatarUrl,
    githubTokens = null,
    googleTokens = null
  } = userInfo
  const [user, created] = await User.findOrCreate({
    where: { provider, providerUserId },
    defaults: {
      provider,
      providerUserId,
      username,
      avatarUrl,
      githubTokens,
      googleTokens
    }
  })

  if (!created) {
    await user.update({
      username,
      avatarUrl,
      githubTokens,
      // 因为谷歌和github不一样，不是每次都返回refreshToken
      // 谷歌通常只返回新的 access_token，继续使用原来的 refresh_token，直到它失效
      googleTokens: googleTokens
        ? {
            ...googleTokens,
            refreshToken:
              googleTokens.refreshToken ??
              user.googleTokens?.refreshToken ??
              null
          }
        : user.googleTokens
    })
  }

  return user
}

export async function getCurrentUser() {
  const session = await getSession()

  if (!session) {
    return null
  }

  return User.findByPk(session.userId, {
    attributes: ['id', 'username', 'avatarUrl', 'provider']
  })
}
