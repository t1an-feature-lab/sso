# sso-server

SSO 服务，使用 Next.js App Router、TypeScript、Tailwind CSS 和 [Astryx](https://astryx.atmeta.com/)。

## 本地开发

以下命令单独启动当前应用；如需启动全部三个应用，执行 `pnpm -w dev`。

```bash
pnpm -w install
pnpm dev
```

默认地址：http://localhost:3000。

## 检查

```bash
pnpm lint
pnpm typecheck
```

## 页面

| 路径 | 内容 |
| --- | --- |
| `/login` | 前后台共用登录，未注册手机号使用输入的密码创建普通账户 |
| `/` | 当前账户的 OAuth / OIDC 应用申请与配置 |
| `/admin/users` | 用户与权限表格 |
| `/admin/applications` | 全部用户的 OAuth / OIDC 应用与配置 |
| `/admin/internal-apps` | 内部子应用列表与详情 |

`/admin` 跳转至用户表格；后台路径在服务端校验管理员角色。侧边栏底部的头像菜单提供个人信息弹窗和主题切换，管理员还可切换前后台。

个人信息弹窗支持编辑用户名和上传头像，头像和应用 Logo 均接受不超过 10 MB 的 PNG、JPEG、WebP 图片，可先预览再统一保存。个人信息保存在数据库中，并同步显示在侧边栏和后台用户列表；登录继续使用原手机号或管理员账号。

## 账户与存储

使用 `src/server/db.ts` 中配置的 PostgreSQL `sso_server` 数据库。首次登录时幂等创建所需表和默认管理员 `admin / admin`，已有管理员密码不会被重置。普通账户使用 11 位大陆手机号，注册密码至少 6 位。

密码通过 scrypt 哈希保存；登录会话使用 HttpOnly Cookie 和数据库中的令牌摘要。应用配置持久化在 PostgreSQL，普通账户只可读取、修改和删除自己的应用。内部子应用初始为空，仅在后台展示列表与详情。OAuth / OIDC 页面提供应用登记与配置管理。

前台入口：`src/app/(account)/page.tsx`。默认使用 Astryx Butter 主题，主题入口由 `npx @astryxdesign/cli theme add butter` 生成在 `src/astryx-themes.ts`；中文、主题模式和 Toast 适配在 `src/app/providers.tsx`，全局布局在 `src/app/globals.css`。界面约定见仓库根目录 `AGENTS.md`。
