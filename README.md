# SSO

## 项目目录结构

```text
sso/
├── auth-center/    # SSO 服务：统一登录、认证、会话管理
├── internal-app/   # 内部子应用：自有系统接入 SSO
└── external-app/   # 外部应用：第三方系统接入 SSO
```

## 启动数据库

在根目录执行：

```sh
docker compose up -d --wait
```

本地开发使用 PostgreSQL 18，地址为 `127.0.0.1:5432`，用户名和密码均为 `postgres`。首次初始化数据目录时，`docker/postgres/init.sql` 会创建 `auth_center`、`internal_app`、`external_app` 三个数据库，并在 `external_app` 中创建用户表。

自动同步不会删除或修改已有列，字段改名、类型调整等变更需要单独迁移。生产环境不执行自动同步，表结构由 SQL 或迁移管理。

## 启动项目

根目录执行 `pnpm dev` 启动所有项目

在子应用目录执行 `pnpm dev` 时，只启动当前应用。

| 项目 | 默认地址 |
| --- | --- |
| `auth-center` | http://localhost:3000 |
| `internal-app` | http://localhost:3001 |
| `external-app` | http://localhost:3002 |
