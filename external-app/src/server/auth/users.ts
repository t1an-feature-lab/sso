import type { Provider } from '@/common/provider'
import { User } from '../models/user'
import { getSession } from './session'

type ProviderIdentity = {
  providerUserId: string
  username: string
  avatarUrl: string | null
}

export async function findOrCreateUser(
  provider: Provider,
  userInfo: ProviderIdentity
) {
  const { providerUserId, username, avatarUrl } = userInfo
  const [user, created] = await User.findOrCreate({
    where: { provider, providerUserId },
    defaults: { provider, providerUserId, username, avatarUrl }
  })

  if (!created) {
    await user.update({ username, avatarUrl })
  }

  return user
}

export async function getCurrentUser() {
  const session = await getSession()

  if (!session) {
    return null
  }

  return User.findByPk(session.userId, {
    attributes: ['id', 'username', 'avatarUrl']
  })
}
