import 'server-only'
import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes
} from 'sequelize'
import type { Provider } from '@/common/provider'
import { db } from '../db'

class UserModel extends Model<
  InferAttributes<UserModel>,
  InferCreationAttributes<UserModel>
> {
  declare id: CreationOptional<string>
  declare provider: Provider
  declare providerUserId: string
  declare username: string
  declare avatarUrl: string | null
  declare createdAt: CreationOptional<Date>
}

export const User = (db.models.User as typeof UserModel | undefined) ?? UserModel.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  provider: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: { isIn: [['github', 'google']] }
  },
  providerUserId: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: { notEmpty: true }
  },
  username: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  avatarUrl: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize: db,
  modelName: 'User',
  tableName: 'external-app_users',
  underscored: true,
  updatedAt: false,
  indexes: [{ unique: true, fields: ['provider', 'provider_user_id'] }]
})
