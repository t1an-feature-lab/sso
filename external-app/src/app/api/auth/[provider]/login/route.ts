import { Provider } from '@/common/provider'
import { beginLogin } from '@/server/auth/flow'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: Provider }> }
) {
  const { provider } = await params
  try {
    const authorizationUrl = await beginLogin(provider)
    const response = NextResponse.redirect(authorizationUrl)
    // 浏览器、CDN 和代理：不要缓存这次接口响应。授权地址里包含本次登录生成的 state、PKCE 参数
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    console.log(error)
    const message =
      error instanceof Error && error.message
        ? error.message
        : '暂时无法发起登录，请检查服务端配置'
    return NextResponse.json({ message }, { status: 500 })
  }
}
