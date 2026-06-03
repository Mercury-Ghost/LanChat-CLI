import { Database } from '../Database';
import { AuthManager } from '../AuthManager';
import { UserRepo } from '../repositories/UserRepo';
import { RegisterRequest, LoginRequest, AuthenticatedUser } from '../../shared/protocol/types';
import { ValidationError } from '../../shared/errors';
import { validateNickname, validatePasswordStrength } from '../../shared/validators';

/**
 * 认证服务类
 * 处理用户注册、登录、密码修改等认证相关业务逻辑
 */
export class AuthService {
  private database: Database;
  private authManager: AuthManager;
  private userRepo: UserRepo;

  /**
     * 构造函数
     * @param database 数据库实例
     * @param authManager 认证管理器实例
     */
  constructor(database: Database, authManager: AuthManager) {
    this.database = database;
    this.authManager = authManager;
    this.userRepo = new UserRepo(database);
  }

  /**
     * 用户注册
     * @param request 注册请求，包含昵称和密码
     * @throws ValidationError 当昵称或密码验证失败时抛出
     */
  async register(request: RegisterRequest): Promise<void> {
    const nicknameValidation = validateNickname(request.nickname);
    if (!nicknameValidation.valid) {
      throw new ValidationError(nicknameValidation.error!);
    }

    const passwordValidation = validatePasswordStrength(request.password);
    if (!passwordValidation.valid) {
      throw new ValidationError(passwordValidation.error!);
    }

    await this.authManager.register(request);
  }

  /**
     * 用户登录
     * @param request 登录请求，包含昵称和密码
     * @returns 认证后的用户信息，包含用户ID、昵称和令牌
     * @throws ValidationError 当昵称或密码验证失败时抛出
     */
  async login(request: LoginRequest): Promise<AuthenticatedUser> {
    const nicknameValidation = validateNickname(request.nickname);
    if (!nicknameValidation.valid) {
      throw new ValidationError(nicknameValidation.error!);
    }

    if (!request.password) {
      throw new ValidationError('密码不能为空');
    }

    return await this.authManager.login(request);
  }

  /**
     * 修改用户密码
     * @param userId 用户ID
     * @param oldPassword 原密码
     * @param newPassword 新密码
     * @throws ValidationError 当原密码为空或新密码强度不足时抛出
     */
  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    if (!oldPassword || oldPassword.trim() === '') {
      throw new ValidationError('原密码不能为空');
    }

    const newPasswordValidation = validatePasswordStrength(newPassword);
    if (!newPasswordValidation.valid) {
      throw new ValidationError(newPasswordValidation.error!);
    }

    await this.authManager.changePassword(userId, oldPassword, newPassword);
  }

  /**
     * 验证 JWT 令牌
     * @param token JWT 令牌
     * @returns 认证用户信息
     */
  verifyToken(token: string): AuthenticatedUser {
    return this.authManager.verifyToken(token);
  }
}
