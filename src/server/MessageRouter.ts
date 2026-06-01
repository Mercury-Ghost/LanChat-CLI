import { Logger } from 'winston';
import { Database } from './Database';
import { AuthManager } from './AuthManager';
import { UserManager } from './UserManager';
import { RoomManager } from './RoomManager';
import { ClientConnection } from './ClientConnection';
import { TlsServer } from './TlsServer';
import { MessageType } from '../shared/protocol/types';
import { AuthenticatedUser } from '../shared/protocol/types';
import { AuthError, AppError } from '../shared/errors';
import { ChatService } from './services/ChatService';
import { FileService } from './services/FileService';
import { AuthHandler } from './handlers/AuthHandler';
import { ChatHandler } from './handlers/ChatHandler';
import { RoomHandler } from './handlers/RoomHandler';
import { FileTransferHandler as FileTransferMessageHandler } from './handlers/FileTransferHandler';
import { UserProfileHandler } from './handlers/UserProfileHandler';

const EXEMPT_TYPES = [
  MessageType.LOGIN_REQUEST,
  MessageType.REGISTER_REQUEST,
  MessageType.HEARTBEAT,
  MessageType.HEARTBEAT_ACK,
];

export class MessageRouter {
  private connection: ClientConnection;
  private server: TlsServer;
  private logger: Logger;
  private authHandler: AuthHandler;
  private chatHandler: ChatHandler;
  private roomHandler: RoomHandler;
  private fileTransferHandler: FileTransferMessageHandler;
  private userProfileHandler: UserProfileHandler;

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
    this.server = server;
    this.logger = logger;

    const chatService = new ChatService(database, userManager, roomManager, server, logger);
    const fileService = new FileService(database, userManager, logger);

    this.authHandler = new AuthHandler(
      connection,
      database,
      authManager,
      userManager,
      roomManager,
      server,
      logger
    );
    this.chatHandler = new ChatHandler(connection, chatService, logger);
    this.roomHandler = new RoomHandler(connection, userManager, roomManager, server, logger);
    this.fileTransferHandler = new FileTransferMessageHandler(
      connection,
      userManager,
      roomManager,
      server,
      fileService,
      logger
    );
    this.userProfileHandler = new UserProfileHandler(
      connection,
      userManager,
      roomManager,
      server,
      logger
    );
  }

  async route(
    socketId: string,
    user: AuthenticatedUser | null,
    type: MessageType,
    payload: Buffer
  ): Promise<void> {
    try {
      if (!EXEMPT_TYPES.includes(type) && !user) {
        throw new AuthError('需要登录才能执行此操作');
      }

      switch (type) {
      case MessageType.LOGIN_REQUEST:
        await this.authHandler.handleLogin(socketId, payload);
        break;

      case MessageType.REGISTER_REQUEST:
        await this.authHandler.handleRegister(socketId, payload);
        break;

      case MessageType.CHAT_ROOM:
        this.chatHandler.handleChatRoom(socketId, user!, payload);
        break;

      case MessageType.CHAT_PRIVATE:
        this.chatHandler.handleChatPrivate(socketId, user!, payload);
        break;

      case MessageType.ROOM_JOIN:
        this.roomHandler.handleRoomJoin(socketId, user!, payload);
        break;

      case MessageType.ROOM_LEAVE:
        this.roomHandler.handleRoomLeave(socketId, user!, payload);
        break;

      case MessageType.NICK_CHANGE:
        this.userProfileHandler.handleNickChange(socketId, user!, payload);
        break;

      case MessageType.HISTORY_REQUEST:
        this.chatHandler.handleHistoryRequest(socketId, user!, payload);
        break;

      case MessageType.FILE_REQUEST:
        this.fileTransferHandler.handleFileRequest(socketId, user!, payload);
        break;

      case MessageType.FILE_RESPONSE:
        this.fileTransferHandler.handleFileResponse(socketId, user!, payload);
        break;

      case MessageType.FILE_CHUNK:
        await this.fileTransferHandler.handleFileChunk(socketId, user!, payload);
        break;

      case MessageType.FILE_END:
        await this.fileTransferHandler.handleFileEnd(socketId, user!, payload);
        break;

      case MessageType.FILE_PROGRESS:
        this.fileTransferHandler.handleFileProgress(socketId, user!, payload);
        break;

      case MessageType.HEARTBEAT:
        this.handleHeartbeat(socketId);
        break;

      case MessageType.HEARTBEAT_ACK:
        this.handleHeartbeatAck(socketId);
        break;

      default:
        this.logger.warn('未知消息类型', { socketId, type });
      }
    } catch (error) {
      this.logger.error('路由消息失败', { socketId, type, error });
      this.connection.sendError(
        error instanceof AppError ? error.code : 'INTERNAL_ERROR',
        error instanceof Error ? error.message : '未知错误'
      );
    }
  }

  private handleHeartbeat(socketId: string): void {
    this.logger.debug('收到心跳包，发送心跳确认', { socketId });
    this.connection.sendMessage(MessageType.HEARTBEAT_ACK, {});
  }

  private handleHeartbeatAck(socketId: string): void {
    this.logger.debug('收到心跳确认，重置超时', { socketId });
    this.connection.resetHeartbeatTimeout();
  }
}
