# Auth Center

## 生成公钥、私钥

具体的生成脚本在 `auth-center/scripts/jwks.js` 中，到 `auth-center` 项目目录执行 `node ./scripts/jwks.js` 即可

把终端输出的内容，填写到 `auth-center/src/app/api/oauth/.well-known/jwks.json/route.ts` 的对应参数中即可
