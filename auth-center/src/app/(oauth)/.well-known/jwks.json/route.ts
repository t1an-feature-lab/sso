import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({
    keys: [
      {
        // 钥匙类型，RS256 固定写 RSA
        kty: 'RSA',
        // 标明这把公钥允许做什么。sig 表示它只用于签名和验签，也就是验证 ID Token 上的 RS256 签名
        use: 'sig',
        // 使用算法，与发现文档一致，写 RS256
        alg: 'RS256',
        // 钥匙的编号，ID Token 头部带同一个编号，接入方才知道用清单里的哪一把
        kid: '11cf7d242daee1a9d134351643b3996fc195cf6f',
        // RSA 公钥的模数
        n: 'yskopZLXUu9XULEdCtfKVvLwoPVOWU3RyFFVBPoWSH05ag8Zkzd_aE40QXtyMaGulBKh2Nbp-PT5BefsMCrzvzT_6L2pKrnVWW_897Hox06vnz7JArcjUZeB68yLybORVB2oP1gkNW8ETGTQZ5smVhRK0gig2m0DddMyUXHxHkV9ZVjYANLA39Ypt5npO7jXgr6ZFAxpexOUS1EFZisq1Z2pBuUGftQ6ut5N6nDo1mjhUVT1J0l_M_aKsQJQzbyftepn1kDSY2d3RCCF4mdsl6HYlKf0s4LxVr4mWo-dZbO1gNFJuHWrjfYZnm3atam1x65uYpcVcRVf8YUZxYemwQ',
        // RSA 公钥的指数。n 和 e 合在一起就是公钥
        e: 'AQAB'
      }
    ]
  })
}
