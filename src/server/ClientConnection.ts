import { Socket } from 'net';
import { EventEmitter } from 'events';
import { Database } from './Database';
import { Logger } from 'winston';
import { TlsServer } from './TlsServer';
import { MessageCodec } from '../shared/protocol/codec';
import { MessageType } from '../shared/protocol/types';
import { MessageRouter } from './MessageRouter';
import { AuthManager } from './AuthManager';
import { UserManager } from './UserManager';
import { RoomManager } from './RoomManager';
import { HeartbeatService } from './HeartbeatService';
import { AuthenticatedUser } from '../shared/protocol/types';

export class ClientConnection extends EventEmitter {
  private socket: Socket;
  private socketId: string;
  private database: Database;
  private logger: Logger;
  private server: TlsServer;
  private receiveBuffer: Buffer = Buffer.alloc(0);
  private authenticatedUser: AuthenticatedUser | null = null;
  private isAlive: boolean = true;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private messageRouter: MessageRouter;
  private authManager: AuthManager;
  private userManager: UserManager;
  private roomManager: RoomManager;
  private heartbeatService: HeartbeatService;

  constructor(
    socket: Socket,
    socketId: string,
    database: Database,
    logger: Logger,
    server: TlsServer,
    authManager: AuthManager,
    userManager: UserManager,
    roomManager: RoomManager
  ) {
    super();
    this.socket = socket;
    this.socketId = socketId;
    this.database = database;
    this.logger = logger;
    this.server = server;
    this.authManager = authManager;
    this.userManager = userManager;
    this.roomManager = roomManager;

    this.messageRouter = new MessageRouter(
      this,
      database,
      this.authManager,
      this.userManager,
      this.roomManager,
      this.server,
      logger
    );
    this.heartbeatService = new HeartbeatService(this, logger);

    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.socket.on('data', (data: Buffer) => {
      this.handleData(data);
    });

    this.socket.on('close', () => {
      this.cleanup();
      this.emit('close');
    });

    this.socket.on('error', (error: Error) => {
      this.logger.error('Socket 错误', { socketId: this.socketId, error: error.message });
    });

    this.socket.on('timeout', () => {
      this.logger.warn('Socket 超时', { socketId: this.socketId });
      this.close();
    });

    this.socket.setTimeout(30000);
  }

  private async handleData(data: Buffer): Promise<void> {
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, data]);
    this.resetHeartbeatTimeout();
    this.processBuffer().catch((error) => {
      this.logger.error('处理数据失败', { socketId: this.socketId, error });
    });
  }

  private async processBuffer(): Promise<void> {
    try {
      const { messages, remaining } = MessageCodec.parseStream(this.receiveBuffer);
      this.receiveBuffer = remaining;

      for (const message of messages) {
        await this.handleMessage(message);
      }
    } catch (error) {
      this.logger.error('消息解析错误', { socketId: this.socketId, error });
      this.sendError('INVALID_MESSAGE', '消息格式错误');
    }
  }

  private async handleMessage(message: { type: MessageType; payload: Buffer }): Promise<void> {
    try {
      await this.messageRouter.route(this.socketId, this.authenticatedUser, message.type, message.payload);
    } catch (error) {
      this.logger.error('消息处理错误', { socketId: this.socketId, error });
    }
  }

  resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }

    this.heartbeatTimeout = setTimeout(() => {
      this.logger.warn('心跳超时，断开连接', { socketId: this.socketId });
      this.close();
    }, 10000);
  }

  setAuthenticated(user: AuthenticatedUser): void {
    this.authenticatedUser = user;
    this.logger.info('用户认证成功', { socketId: this.socketId, nickname: user.nickname });
    this.resetHeartbeatTimeout();
    this.heartbeatService.start();
  }

  getAuthenticatedUser(): AuthenticatedUser | null {
    return this.authenticatedUser;
  }

  getSocketId(): string {
    return this.socketId;
  }

  send(buffer: Buffer): void {
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(buffer);
    }
  }

  sendMessage(type: MessageType, payload: object): void {
    const buffer = MessageCodec.encodeJson(type, payload);
    this.send(buffer);
  }

  sendError(code: string, message: string): void {
    this.sendMessage(MessageType.ERROR, { code, message });
  }

  private cleanup(): void {
    this.logger.debug('开始清理连接资源', { socketId: this.socketId });

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
      this.logger.debug('已清除心跳超时定时器', { socketId: this.socketId });
    }

    if (this.authenticatedUser) {
      // 先从 UserManager 获取用户信息以确定 activeRoom
      const onlineUser = this.userManager.getUser(this.socketId);
      
      // 离开当前活动房间（如果不是默认房间）
      if (onlineUser && onlineUser.activeRoom !== this.roomManager.getDefaultRoom()) {
        try {
          this.roomManager.leaveRoom(onlineUser.activeRoom, this.authenticatedUser.userId);
        } catch (e) {
          this.logger.debug('离开房间时出错', { socketId: this.socketId, error: e });
        }
      }
      
      // 从默认房间中移除用户
      this.roomManager.removeFromDefaultRoom(this.authenticatedUser.userId);
      
      // 从 UserManager 中移除用户
      this.userManager.removeUser(this.socketId);

      // 通知其他用户用户已离线
      const remainingUsers = this.userManager.getOnlineUsers();
      const message = MessageCodec.encodeJson(MessageType.USER_LIST, { users: remainingUsers });
      this.server.broadcast(message);
    }

    this.heartbeatService.stop();
    this.logger.debug('连接资源清理完成', { socketId: this.socketId });
  }

  close(): void {
    this.cleanup();
    if (!this.socket.destroyed) {
      this.socket.destroy();
    }
  }
}
