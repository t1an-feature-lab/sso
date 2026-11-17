import { Provider } from '@/common/provider'
import { finishLogin } from '@/server/auth/flow'
import { NextResponse } from 'next/server'

// github调用：/api/auth/github/callback?code=xxx&iss=https%3A%2F%2Fgithub.com%2Flogin%2Foauth&state=xxx
// iss：https://github.com/login/oauth
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: Provider }> }
) {
  const { provider } = await params

  try {
    const { searchParams } = new URL(_request.url)
    const loginRedirectUrl = await finishLogin(provider, {
      code: searchParams.get('code'), // 服务端用它换取 access token
      state: searchParams.get('state'), // 与登录前保存的值比较，确认属于本次登录（自己应用cookie中取）
      iss: searchParams.get('iss'), // 标识授权服务器，用于防止不同登录提供方之间的混淆
      error: searchParams.get('error') // 授权失败或用户拒绝授权时的错误码
    })

    const response = NextResponse.redirect(loginRedirectUrl)
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    console.log(error)
    const message =
      error instanceof Error && error.message
        ? error.message
        : '暂时无法完成登录，请重新发起登录'
    return NextResponse.json(
      { message },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' }
      }
    )
  }
}
