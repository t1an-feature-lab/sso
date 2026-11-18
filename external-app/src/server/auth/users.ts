import type { Provider } from '@/common/provider'
import { GitHubTokens, User } from '../models/user'
import { getSession } from './session'

type ProviderIdentity = {
  providerUserId: string
  username: string
  avatarUrl: string | null
  githubTokens?: GitHubTokens
}

export async function findOrCreateUser(
  provider: Provider,
  userInfo: ProviderIdentity
) {
  const { providerUserId, username, avatarUrl, githubTokens = null } = userInfo
  const [user, created] = await User.findOrCreate({
    where: { provider, providerUserId },
    defaults: { provider, providerUserId, username, avatarUrl, githubTokens }
  })

  if (!created) {
    await user.update({ username, avatarUrl, githubTokens })
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
