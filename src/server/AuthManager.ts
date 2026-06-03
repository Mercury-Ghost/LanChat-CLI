import * as jwt from 'jsonwebtoken';
import * as argon2 from 'argon2';
import { Database } from './Database';
import { UserRepo } from './repositories/UserRepo';
import { AuthError, ValidationError } from '../shared/errors';
import { validatePasswordStrength } from '../shared/validators';
import {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  ARGON2_TIME_COST,
  ARGON2_MEMORY_COST,
  ARGON2_PARALLELISM,
  ARGON2_HASH_LENGTH,
} from '../shared/constants';
import { AuthenticatedUser, LoginRequest, RegisterRequest } from '../shared/protocol/types';

export class AuthManager {
  private database: Database;
  private userRepo: UserRepo;

  constructor(database: Database) {
    this.database = database;
    this.userRepo = new UserRepo(database);
  }

  async register(request: RegisterRequest): Promise<void> {
    const { nickname, password } = request;

    const existingUser = this.userRepo.findByNickname(nickname);
    if (existingUser) {
      throw new AuthError('昵称已被占用');
    }

    const hashedPassword = await this.hashPassword(password);
    this.userRepo.create(nickname, hashedPassword);
  }

  async login(request: LoginRequest): Promise<AuthenticatedUser> {
    const { nickname, password } = request;

    if (!nickname || !password) {
      throw new ValidationError('昵称和密码不能为空');
    }

    const user = this.userRepo.findByNickname(nickname);
    if (!user) {
      throw new AuthError('用户名或密码错误');
    }

    const isValid = await this.verifyPassword(password, user.password);
    if (!isValid) {
      throw new AuthError('用户名或密码错误');
    }

    const token = this.generateToken(user.id, nickname);

    return {
      userId: user.id,
      nickname: user.nickname,
      token,
    };
  }

  async hashPassword(password: string): Promise<string> {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      timeCost: ARGON2_TIME_COST,
      memoryCost: ARGON2_MEMORY_COST,
      parallelism: ARGON2_PARALLELISM,
      hashLength: ARGON2_HASH_LENGTH,
    });
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await argon2.verify(hash, password);
  }

  generateToken(userId: number, nickname: string): string {
    const payload = {
      sub: userId.toString(),
      nickname,
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
  }

  verifyToken(token: string): AuthenticatedUser {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
                sub: string;
                nickname: string;
            };

      return {
        userId: parseInt(decoded.sub, 10),
        nickname: decoded.nickname,
        token,
      };
    } catch {
      throw new AuthError('令牌无效或已过期');
    }
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<void> {
    const user = this.userRepo.findById(userId);
    if (!user) {
      throw new ValidationError('用户不存在');
    }

    const isValid = await this.verifyPassword(oldPassword, user.password);
    if (!isValid) {
      throw new AuthError('原密码错误');
    }

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      throw new ValidationError(passwordValidation.error!);
    }

    const hashedPassword = await this.hashPassword(newPassword);
    this.userRepo.updatePassword(userId, hashedPassword);
  }
}
