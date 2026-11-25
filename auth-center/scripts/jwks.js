import { generateKeyPairSync, createHash } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048
})
const jwk = publicKey.export({ format: 'jwk' })
const kid = createHash('sha256').update(jwk.n).digest('hex').slice(0, 40)

console.log(
  JSON.stringify({
    kty: 'RSA',
    use: 'sig',
    alg: 'RS256',
    kid,
    n: jwk.n,
    e: jwk.e
  }, null, 2)
)

console.error(privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'))
