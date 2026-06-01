import { Logger } from 'winston';
import { Database } from '../Database';
import { AuthManager } from '../AuthManager';
import { UserManager } from '../UserManager';
import { RoomManager } from '../RoomManager';
import { ClientConnection } from '../ClientConnection';
import { TlsServer } from '../TlsServer';
import { MessageType } from '../../shared/protocol/types';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RoomListMessage,
  UserListMessage,
} from '../../shared/protocol/types';
import { MessageCodec } from '../../shared/protocol/codec';
import { AppError } from '../../shared/errors';

export class AuthHandler {
  private database: Database;
  private authManager: AuthManager;
  private userManager: UserManager;
  private roomManager: RoomManager;
  private connection: ClientConnection;
  private server: TlsServer;
  private logger: Logger;

  constructor(
    connection: ClientConnection,
    database: Database,
    authManager: AuthManager,
    userManager: UserManager,
    roomManager: RoomManager,
    server: TlsServer,
    logger: Logger
  ) {
    this.connection = connection;
    this.database = database;
    this.authManager = authManager;
    this.userManager = userManager;
    this.roomManager = roomManager;
    this.server = server;
    this.logger = logger;
  }

  async handleLogin(socketId: string, payload: Buffer): Promise<void> {
    try {
      const { payload: data } = MessageCodec.decodeJson<LoginRequest>(payload);
      const request = data;

      const user = await this.authManager.login(request);
      this.connection.setAuthenticated(user);
      this.userManager.addUser(socketId, user.userId, user.nickname);

      const response: LoginResponse = {
        success: true,
        token: user.token,
        userId: user.userId,
        nickname: user.nickname,
      };
      this.connection.sendMessage(MessageType.LOGIN_RESPONSE, response);

      this.logger.info('用户登录成功', { socketId, userId: user.userId, nickname: user.nickname });

      this.sendRoomList();
      this.sendUserList();
    } catch (error) {
      this.logger.error('登录失败', { socketId, error });
      this.connection.sendError(
        error instanceof AppError ? error.code : 'LOGIN_FAILED',
        error instanceof Error ? error.message : '登录失败'
      );
    }
  }

  async handleRegister(socketId: string, payload: Buffer): Promise<void> {
    try {
      const { payload: data } = MessageCodec.decodeJson<RegisterRequest>(payload);
      const request = data;

      await this.authManager.register(request);

      const response: RegisterResponse = {
        success: true,
        message: '注册成功',
      };
      this.connection.sendMessage(MessageType.REGISTER_RESPONSE, response);

      this.logger.info('用户注册成功', { nickname: request.nickname });
    } catch (error) {
      this.logger.error('注册失败', { socketId, error });
      this.connection.sendError(
        error instanceof AppError ? error.code : 'REGISTER_FAILED',
        error instanceof Error ? error.message : '注册失败'
      );
    }
  }

  private sendRoomList(): void {
    const rooms = this.roomManager.getAllRooms();
    const message: RoomListMessage = { rooms };
    this.connection.sendMessage(MessageType.ROOM_LIST, message);
  }

  private sendUserList(): void {
    const users = this.userManager.getOnlineUsers();
    const message: UserListMessage = { users };
    this.server.broadcast(MessageCodec.encodeJson(MessageType.USER_LIST, message));
  }
}
