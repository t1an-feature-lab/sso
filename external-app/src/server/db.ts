import 'server-only'
import { Sequelize } from 'sequelize'

const globalForDb = globalThis as typeof globalThis & {
  externalAppSequelize?: Sequelize
}

export const db = globalForDb.externalAppSequelize ?? new Sequelize(
  'postgresql://postgres:postgres@127.0.0.1:5432/external_app',
  { logging: false }
)

// 开发环境热更新时复用连接池。
globalForDb.externalAppSequelize = db
