# SSO

## 项目目录结构

```text
sso/
├── sso-server/     # SSO 服务：统一登录、认证、会话管理
├── internal-app/   # 内部子应用：自有系统接入 SSO
└── external-app/   # 外部子应用：第三方系统接入 SSO
```

三个项目通过 pnpm workspace 管理依赖、Turborepo 管理开发任务，统一使用 Next.js App Router、TypeScript、Tailwind CSS 和 [Astryx](https://astryx.atmeta.com/)。

## 本地开发

使用 Node.js 24 LTS 和 pnpm 10，在仓库根目录执行一次 `pnpm install` 安装所有项目依赖，统一使用根目录的 `pnpm-lock.yaml`。

在仓库根目录一键启动三个项目：

```bash
pnpm dev
```

[Turbo 终端界面](https://turborepo.dev/docs/crafting-your-repository/developing-applications#using-the-terminal-ui)会列出三个应用的 `dev` 任务，可以选择应用查看各自日志；看到对应的 `Ready` 日志即表示该应用已就绪。按 `Ctrl+C` 统一停止。

在任意子应用目录中，也可以通过以下命令启动全部三个应用：

```bash
pnpm -w dev
```

在子应用目录执行 `pnpm dev` 时，只启动当前应用。

| 项目 | 默认地址 |
| --- | --- |
| `sso-server` | http://localhost:3000 |
| `internal-app` | http://localhost:3001 |
| `external-app` | http://localhost:3002 |

每个项目支持 `pnpm lint` 和 `pnpm typecheck`。

Astryx 已配置默认主题、Next.js 链接适配及 [Tailwind 样式集成](https://astryx.atmeta.com/docs/styling-overview)。
