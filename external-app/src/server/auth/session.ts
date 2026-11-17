import { jwtVerify, SignJWT } from 'jose'
import { cookies } from 'next/headers'

const secure = process.env.NODE_ENV === 'production'
const cookieName = `${secure ? '__Host-' : ''}external_app_session`
const maxAge = 60 * 60 * 24 * 7

const cookieOptions = {
  httpOnly: true,
  secure,
  sameSite: 'lax' as const,
  path: '/'
}

function getSigningKey() {
  const secret = process.env.JWT_SECRET_KEY

  if (!secret) {
    throw new Error('缺少 JWT_SECRET_KEY')
  }

  const key = new TextEncoder().encode(secret)
  return key
}

// 创建token
export async function createSession(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + maxAge

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer('external-app')
    .setAudience('external-app')
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSigningKey())

  const cookieStore = await cookies()

  cookieStore.set(cookieName, token, {
    ...cookieOptions,
    expires: new Date(expiresAt * 1000)
  })
}

export async function getSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(cookieName)?.value

  if (!token) {
    return null
  }

  const key = getSigningKey()

  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      issuer: 'external-app',
      audience: 'external-app',
      requiredClaims: ['sub', 'exp']
    })

    if (typeof payload.sub !== 'string' || !payload.sub) {
      return null
    }

    return { userId: payload.sub }
  } catch {
    return null
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()

  cookieStore.set(cookieName, '', {
    ...cookieOptions,
    maxAge: 0
  })
}
