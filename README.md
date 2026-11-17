# SSO

## 项目目录结构

```text
sso/
├── sso-server/     # SSO 服务：统一登录、认证、会话管理
├── internal-app/   # 内部子应用：自有系统接入 SSO
└── external-app/   # 外部应用：第三方系统接入 SSO
```

## 启动数据库

在根目录执行：

```sh
docker compose up -d --wait
```

本地开发使用 PostgreSQL 18，地址为 `127.0.0.1:5432`，用户名和密码均为 `postgres`。首次初始化数据目录时，`docker/postgres/init.sql` 会创建 `sso_server`、`internal_app`、`external_app` 三个数据库，并在 `external_app` 中创建用户表。应用连接配置已对应这些数据库，应用请求不再自动建表。

已有数据卷不会重新执行初始化 SQL。已有用户表可以继续使用；如果 `external_app` 库中缺少用户表，需要连接该库并单独执行 `init.sql` 中的建表语句。

## 启动项目

根目录执行 `pnpm dev` 启动所有项目

在子应用目录执行 `pnpm dev` 时，只启动当前应用。

| 项目 | 默认地址 |
| --- | --- |
| `sso-server` | http://localhost:3000 |
| `internal-app` | http://localhost:3001 |
| `external-app` | http://localhost:3002 |
