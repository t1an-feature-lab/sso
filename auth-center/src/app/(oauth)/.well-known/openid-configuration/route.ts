import { oidcScopes } from '@/server/oauth/scope'
import { NextResponse } from 'next/server'

// http://localhost:3000
export const issuer = (
  process.env.AUTH_CENTER_ORIGIN ?? 'http://localhost:3000'
).replace(/\/+$/, '')

// 参考：https://accounts.google.com/.well-known/openid-configuration
export function GET() {
  return NextResponse.json({
    // 🌟发行者标识。授权回调里的 iss 和 ID Token 里的 iss 都必须等于它
    issuer,
    // 🌟授权登录跳转的地址，需要携带上 client_id、redirect_uri、scope、state、PKCE
    authorization_endpoint: `${issuer}/oauth/authorize`,
    // 🌟code 码换 access token 的地址，或用 refresh token 刷新
    // 是根据 grant_type 来区分的：authorization_code是换 access_token，refresh_token 是换 refresh token 的
    token_endpoint: `${issuer}/oauth/token`,
    // 🌟用 access token 换用户资料的接口
    userinfo_endpoint: `${issuer}/oauth/userinfo`,
    // 公钥地址。接入方用这里的公钥验证 id token 的 RS256 签名
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    // 🌟接入方可以通过这个接口撤销 access_token 和 refresh_token
    revocation_endpoint: `${issuer}/oauth/revoke`,
    // oidc授权时可以申请的权限范围，根据自己的系统来定义
    scopes_supported: [...oidcScopes],
    // 定义在 authorization_endpoint 同意授权后，回调地址返回的参数，只包含code（当前有其他的state、iss参数，这里只是包含授权相关的参数）
    response_types_supported: ['code'],
    // 🌟token_endpoint 接受的两种请求类型，用于区别是换 access_token 还是 refresh_token
    grant_types_supported: ['authorization_code', 'refresh_token'],
    // 同一个用户在所有应用里的 sub 都是同一个用户 ID
    subject_types_supported: ['public'],
    // ID Token 只用 RS256 签名。接入方按这个算法，用 jwks_uri 的公钥验签
    id_token_signing_alg_values_supported: ['RS256'],
    // PKCE 只接受 S256。授权时带 code_challenge，换票时带对应的 code_verifier
    code_challenge_methods_supported: ['S256'],
    // 声明 client_id 和 client_secret 的存放位置
    token_endpoint_auth_methods_supported: [
      // 放在url query里
      'client_secret_post',
      // 放在 Authorization 请求头
      'client_secret_basic'
    ]
  })
}
