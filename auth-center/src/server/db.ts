import 'server-only'
import { Sequelize } from 'sequelize'

const globalForDb = globalThis as typeof globalThis & {
  authCenterSequelize?: Sequelize
}

export const db = globalForDb.authCenterSequelize ?? new Sequelize(
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/auth_center',
  { logging: false }
)

// 开发环境热更新时复用连接池。
globalForDb.authCenterSequelize = db
