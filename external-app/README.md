# external-app

## 目录结构

```text
external-app/src/
├── app/
│   ├── login/page.tsx                     # 页面和两个按钮
│   └── api/auth/[provider]/
│       ├── login/route.ts                 # 发起授权
│       └── callback/route.ts              # 接收授权回调
└── server/auth/
    ├── github.ts                          # GitHub 登录逻辑
    ├── google.ts                          # Google 登录逻辑
    ├── flow.ts                            # 公共登录流程
    ├── session.ts                         # 当前应用的登录会话
    └── users.ts                           # 用户查询、创建、账号关联
```

- `github.ts`、`google.ts`：各自处理授权地址、授权码交换、身份获取或验证，最终返回统一的用户身份。
- `flow.ts`：处理登录事务、`state`、PKCE，调用对应登录方式，再关联用户并建立会话。
- `session.ts`：创建、校验、注销会话。
- `users.ts`：封装数据库操作，使用提供方和提供方用户 ID 关联本站用户。
- `route.ts`：只处理请求参数、调用核心函数和返回 HTTP 响应。
