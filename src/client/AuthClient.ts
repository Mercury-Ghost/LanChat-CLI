import { Transport } from './Transport';
import { MessageCodec } from '../shared/protocol/codec';
import { MessageType } from '../shared/protocol/types';
import { LoginRequest, RegisterRequest, ChangePasswordRequest } from '../shared/protocol/types';
import { LocalStore } from './LocalStore';

/**
 * 认证客户端类
 * 
 * @description 负责处理用户的认证相关操作，包括登录、注册和密码修改
 *              通过传输层与服务器进行安全通信
 * 
 * @example
 * ```typescript
 * const auth = new AuthClient(transport);
 * 
 * // 登录
 * await auth.login('username', 'password');
 * 
 * // 注册
 * await auth.register('newuser', 'password');
 * ```
 */
export class AuthClient {
  /** 传输层实例 */
  private transport: Transport;
  
  /** 本地存储实例 */
  private localStore: LocalStore;

  /**
   * 构造函数
   * 
   * @param transport - 传输层实例
   */
  constructor(transport: Transport) {
    this.transport = transport;
    this.localStore = new LocalStore();
  }

  /**
   * 用户登录
   * 
   * @param nickname - 用户昵称
   * @param password - 用户密码
   * @returns {Promise<void>} 登录请求发送成功后 resolve
   * 
   * @description 向服务器发送登录请求
   * 
   * @example
   * ```typescript
   * try {
   *   await auth.login('alice', 'password123');
   *   console.log('登录成功');
   * } catch (error) {
   *   console.error('登录失败:', error.message);
   * }
   * ```
   */
  async login(nickname: string, password: string): Promise<void> {
    const request: LoginRequest = {
      nickname,
      password,
    };

    const buffer = MessageCodec.encodeJson(MessageType.LOGIN_REQUEST, request);
    this.transport.send(buffer);
  }

  /**
   * 用户注册
   * 
   * @param nickname - 选择的昵称
   * @param password - 设置的密码
   * @returns {Promise<void>} 注册请求发送成功后 resolve
   * 
   * @description 向服务器发送注册请求
   * 
   * @example
   * ```typescript
   * try {
   *   await auth.register('newuser', 'password123');
   *   console.log('注册成功');
   * } catch (error) {
   *   console.error('注册失败:', error.message);
   * }
   * ```
   */
  async register(nickname: string, password: string): Promise<void> {
    const request: RegisterRequest = {
      nickname,
      password,
    };

    const buffer = MessageCodec.encodeJson(MessageType.REGISTER_REQUEST, request);
    this.transport.send(buffer);
  }

  /**
   * 修改密码
   * 
   * @param oldPassword - 旧密码
   * @param newPassword - 新密码
   * @returns {Promise<void>} 密码修改请求发送成功后 resolve
   * 
   * @description 向服务器发送密码修改请求（需要已登录）
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const request: ChangePasswordRequest = {
      oldPassword,
      newPassword,
      token: this.localStore.getToken() || '',
    };

    const buffer = MessageCodec.encodeJson(MessageType.CHANGE_PASSWORD, request);
    this.transport.send(buffer);
  }
}
