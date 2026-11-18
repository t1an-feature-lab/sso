import { redirect } from 'next/navigation'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { IconButton } from '@astryxdesign/core/IconButton'
import { VStack } from '@astryxdesign/core/Layout'
import { logout } from '@/server/auth/actions'
import { getCurrentUser } from '@/server/auth/users'
import { AccountProfile, profileStrategies } from './profile-strategies'

export default async function Home({
  searchParams
}: {
  searchParams: Promise<{ view?: string | string[] }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const showProvider = (await searchParams).view === 'provider'
  const { label, Component: ProviderProfile } = profileStrategies[user.provider]
  const switchLabel = showProvider ? '查看本站资料' : `查看 ${label} 资料`

  return (
    <main aria-label='账户'>
      <Center
        axis='both'
        padding={6}
        minHeight='100dvh'
        style={{ backgroundColor: 'var(--color-background-body)' }}
      >
        <Card padding={8} width='100%' maxWidth={400} style={{ position: 'relative' }}>
          <IconButton
            as='a'
            href={showProvider ? '/' : '/?view=provider'}
            label={switchLabel}
            tooltip={switchLabel}
            variant='ghost'
            style={{ position: 'absolute', top: 12, right: 12, minWidth: 40, minHeight: 40 }}
            icon={
              <svg
                viewBox='0 0 24 24'
                width={20}
                height={20}
                fill='none'
                stroke='currentColor'
                strokeWidth={1.75}
                strokeLinecap='round'
                strokeLinejoin='round'
                aria-hidden='true'
              >
                <path d='M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4' />
              </svg>
            }
          />
          <VStack gap={6} hAlign='stretch'>
            {showProvider ? (
              <ProviderProfile />
            ) : (
              <AccountProfile
                id={user.id}
                username={user.username}
                avatarUrl={user.avatarUrl}
              />
            )}

            <form action={logout}>
              <Button
                type='submit'
                label='退出登录'
                variant='secondary'
                size='lg'
                width='100%'
              />
            </form>
          </VStack>
        </Card>
      </Center>
    </main>
  )
}
