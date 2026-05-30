import { Database } from '../Database';
import { AuthManager } from '../AuthManager';
import { UserRepo } from '../repositories/UserRepo';
import { RegisterRequest, LoginRequest, AuthenticatedUser } from '../../shared/protocol/types';
import { AuthError, ValidationError } from '../../shared/errors';
import { validateNickname, validatePassword } from '../../shared/validators';

export class AuthService {
  private database: Database;
  private authManager: AuthManager;
  private userRepo: UserRepo;

  constructor(database: Database, authManager: AuthManager) {
    this.database = database;
    this.authManager = authManager;
    this.userRepo = new UserRepo(database);
  }

  async register(request: RegisterRequest): Promise<void> {
    const nicknameValidation = validateNickname(request.nickname);
    if (!nicknameValidation.valid) {
      throw new ValidationError(nicknameValidation.error!);
    }

    const passwordValidation = validatePassword(request.password);
    if (!passwordValidation.valid) {
      throw new ValidationError(passwordValidation.error!);
    }

    await this.authManager.register(request);
  }

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

  async changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const oldPasswordValidation = validatePassword(oldPassword);
    if (!oldPasswordValidation.valid) {
      throw new ValidationError(oldPasswordValidation.error!);
    }

    const newPasswordValidation = validatePassword(newPassword);
    if (!newPasswordValidation.valid) {
      throw new ValidationError(newPasswordValidation.error!);
    }

    await this.authManager.changePassword(userId, oldPassword, newPassword);
  }

  verifyToken(token: string): AuthenticatedUser {
    return this.authManager.verifyToken(token);
  }
}
