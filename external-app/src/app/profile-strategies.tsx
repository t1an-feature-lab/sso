import 'server-only'
import type { ComponentType } from 'react'
import { Avatar } from '@astryxdesign/core/Avatar'
import { VStack } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import type { Provider } from '@/common/provider'
import { getGitHubProfile } from '@/server/auth/github'
import { getGoogleProfile } from '@/server/auth/google'

type AccountProfileProps = {
  id: string
  username: string
  avatarUrl: string | null
  idLabel?: string
}

export function AccountProfile({
  id,
  username,
  avatarUrl,
  idLabel = '用户 ID'
}: AccountProfileProps) {
  const nickname = username || '未设置昵称'

  return (
    <VStack gap={6} hAlign='stretch'>
      <VStack gap={3} hAlign='center'>
        <Avatar
          src={avatarUrl ?? undefined}
          name={nickname}
          alt={`${nickname}的头像`}
          size={64}
        />
        <Heading
          level={1}
          justify='center'
          style={{ overflowWrap: 'anywhere', maxWidth: '100%' }}
        >
          {nickname}
        </Heading>
      </VStack>

      <VStack gap={2} hAlign='stretch'>
        <Text type='supporting'>{idLabel}</Text>
        <Text as='p' type='code' style={{ overflowWrap: 'anywhere' }}>
          {id}
        </Text>
      </VStack>
    </VStack>
  )
}

async function GitHubProfile() {
  let profile
  let error = ''

  try {
    profile = await getGitHubProfile()
  } catch {
    error = '暂时无法获取 GitHub 资料，请稍后重试。'
  }

  if (!profile) {
    return (
      <VStack gap={3} hAlign='center' style={{ paddingTop: 24 }}>
        <Heading level={1} justify='center'>GitHub 用户资料</Heading>
        <Text as='p' role='alert'>
          {error || '请重新使用 GitHub 登录，以获取用户资料'}
        </Text>
      </VStack>
    )
  }

  return (
    <AccountProfile
      id={String(profile.id)}
      username={profile.name || profile.login}
      avatarUrl={profile.avatar_url}
      idLabel='GitHub 用户 ID'
    />
  )
}

async function GoogleProfile() {
  let profile
  let error = ''

  try {
    profile = await getGoogleProfile()
  } catch {
    error = '暂时无法获取 Google 资料，请稍后重试或重新授权。'
  }

  if (!profile) {
    return (
      <VStack gap={3} hAlign='center' style={{ paddingTop: 24 }}>
        <Heading level={1} justify='center'>Google 用户资料</Heading>
        <Text as='p' role='alert'>
          {error || '请重新使用 Google 登录，以获取用户资料'}
        </Text>
      </VStack>
    )
  }

  return (
    <AccountProfile
      id={profile.sub}
      username={profile.name || profile.sub}
      avatarUrl={profile.picture || null}
      idLabel='Google 用户 ID'
    />
  )
}

export const profileStrategies: Record<
  Provider,
  { label: string; Component: ComponentType }
> = {
  github: { label: 'GitHub', Component: GitHubProfile },
  google: { label: 'Google', Component: GoogleProfile }
}
