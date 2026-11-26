# Auth Center

## 数据库

使用 Prisma ORM 7 和 PostgreSQL，模型定义位于 `prisma/schema.prisma`，应用通过 Prisma Client 查询和修改数据

`DATABASE_URL` 在 `.env` 中配置，未配置时连接本机 `127.0.0.1:5432/auth_center`

在项目根目录安装依赖后，执行以下命令创建数据库表和初始管理员：

```sh
pnpm --filter auth-center db:migrate
pnpm --filter auth-center db:seed
```

初始管理员账号为 `admin`，密码为 `admin`，重复执行 seed 不会覆盖已有账号或密码

主要数据表为 `users`、`sessions`、`applications`、`client_secrets`、`user_application_authorizations` 和 `application_tokens`

内部子应用页面目前保留前端占位

- 修改模型后执行 `pnpm --filter auth-center exec prisma migrate dev --name <变更名称>` 创建并应用迁移
- 执行 `pnpm --filter auth-center db:generate` 重新生成客户端，安装依赖时也会自动生成
- 执行 `pnpm --filter auth-center db:studio` 查看数据库

## 生成公钥、私钥

具体的生成脚本在 `auth-center/scripts/jwks.js` 中，到 `auth-center` 项目目录执行 `node ./scripts/jwks.js` 即可

把终端输出的内容，填写到 `auth-center/src/app/api/oauth/.well-known/jwks.json/route.ts` 的对应参数中即可
