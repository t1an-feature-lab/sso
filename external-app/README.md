# external-app

外部子应用，使用 Next.js App Router、TypeScript、Tailwind CSS 和 [Astryx](https://astryx.atmeta.com/)。

## 本地开发

以下命令单独启动当前应用；如需启动全部三个应用，执行 `pnpm -w dev`。

```bash
pnpm -w install
pnpm dev
```

默认地址：http://localhost:3002。

## 检查

```bash
pnpm lint
pnpm typecheck
```

页面入口：`src/app/page.tsx`。Astryx 主题和链接适配在 `src/app/providers.tsx`，全局样式在 `src/app/globals.css`。
