# SSO

## 项目目录结构

```text
sso/
├── sso-server/     # SSO 服务：统一登录、认证、会话管理
├── internal-app/   # 内部子应用：自有系统接入 SSO
└── external-app/   # 外部应用：第三方系统接入 SSO
```

## 启动项目

根目录执行 `pnpm dev` 启动所有项目

在子应用目录执行 `pnpm dev` 时，只启动当前应用。

| 项目 | 默认地址 |
| --- | --- |
| `sso-server` | http://localhost:3000 |
| `internal-app` | http://localhost:3001 |
| `external-app` | http://localhost:3002 |
