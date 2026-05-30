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
import { HeartbeatService } from './HeartbeatService';
import { AuthenticatedUser } from '../shared/protocol/types';
import * as uuid from 'uuid';

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
  private heartbeatService: HeartbeatService;

  constructor(
    socket: Socket,
    socketId: string,
    database: Database,
    logger: Logger,
    server: TlsServer
  ) {
    super();
    this.socket = socket;
    this.socketId = socketId;
    this.database = database;
    this.logger = logger;
    this.server = server;

    this.authManager = new AuthManager(database);
    this.userManager = new UserManager(logger);
    this.messageRouter = new MessageRouter(this, database, this.authManager, this.userManager, logger);
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

  private handleData(data: Buffer): void {
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, data]);
    this.resetHeartbeatTimeout();
    this.processBuffer();
  }

  private processBuffer(): void {
    try {
      const { messages, remaining } = MessageCodec.parseStream(this.receiveBuffer);
      this.receiveBuffer = remaining;

      for (const message of messages) {
        this.handleMessage(message);
      }
    } catch (error) {
      this.logger.error('消息解析错误', { socketId: this.socketId, error });
      this.sendError('INVALID_MESSAGE', '消息格式错误');
    }
  }

  private handleMessage(message: { type: MessageType; payload: Buffer }): void {
    try {
      this.messageRouter.route(this.socketId, this.authenticatedUser, message.type, message.payload);
    } catch (error) {
      this.logger.error('消息处理错误', { socketId: this.socketId, error });
    }
  }

  private resetHeartbeatTimeout(): void {
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
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }

    if (this.authenticatedUser) {
      this.userManager.removeUser(this.socketId);
    }

    this.heartbeatService.stop();
  }

  close(): void {
    this.cleanup();
    if (!this.socket.destroyed) {
      this.socket.destroy();
    }
  }
}
