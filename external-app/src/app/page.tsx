import { redirect } from 'next/navigation'
import { Avatar } from '@astryxdesign/core/Avatar'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { VStack } from '@astryxdesign/core/Layout'
import { Heading, Text } from '@astryxdesign/core/Text'
import { logout } from '@/server/auth/actions'
import { getCurrentUser } from '@/server/auth/users'

export default async function Home() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const nickname = user.username || '未设置昵称'

  return (
    <main aria-label='账户'>
      <Center
        axis='both'
        padding={6}
        minHeight='100dvh'
        style={{ backgroundColor: 'var(--color-background-body)' }}
      >
        <Card padding={8} width='100%' maxWidth={400}>
          <VStack gap={6} hAlign='stretch'>
            <VStack gap={3} hAlign='center'>
              <Avatar
                src={user.avatarUrl ?? undefined}
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
              <Text type='supporting'>用户 ID</Text>
              <Text as='p' type='code' style={{ overflowWrap: 'anywhere' }}>
                {user.id}
              </Text>
            </VStack>

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
