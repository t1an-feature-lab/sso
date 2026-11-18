export async function register() {
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.NEXT_RUNTIME !== 'nodejs'
  ) {
    return
  }

  const { User } = await import('./server/models/user')

  // 仅补齐缺失字段，避免开发启动时删除或改写已有列。
  await User.sync({ alter: { drop: false } })
}
