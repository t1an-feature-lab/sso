import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { getCurrentUser } from '@/server/auth/users'
import LoginButtons from './login-buttons'

export const metadata: Metadata = {
  title: 'SSO Login'
}

export default async function LoginPage() {
  const user = await getCurrentUser()

  if (user) {
    redirect('/')
  }

  return (
    <main aria-label='登录'>
      <Center
        axis='both'
        padding={6}
        minHeight='100dvh'
        style={{ backgroundColor: 'var(--color-background-body)' }}
      >
        <Card
          padding={8}
          width='100%'
          maxWidth={400}
        >
          <LoginButtons />
        </Card>
      </Center>
    </main>
  )
}
