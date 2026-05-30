import { Logger } from 'winston';
import { Database } from './Database';
import { AuthManager } from './AuthManager';
import { UserManager } from './UserManager';
import { ClientConnection } from './ClientConnection';
import { MessageType } from '../shared/protocol/types';
import {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ChatRoomPayload,
  ChatPrivatePayload,
  RoomJoinRequest,
  RoomJoinResponse,
  NickChangeRequest,
  NickChangeResponse,
  HistoryRequestPayload,
  FileRequestPayload,
  FileResponsePayload,
  AuthenticatedUser,
} from '../shared/protocol/types';
import { MessageCodec } from '../shared/protocol/codec';
import { validateMessage } from '../shared/validators';
import { AuthError, ValidationError } from '../shared/errors';
import { ChatService } from './services/ChatService';
import { FileService } from './services/FileService';

const EXEMPT_TYPES = [
  MessageType.LOGIN_REQUEST,
  MessageType.REGISTER_REQUEST,
  MessageType.HEARTBEAT,
  MessageType.HEARTBEAT_ACK,
];

export class MessageRouter {
  private database: Database;
  private authManager: AuthManager;
  private userManager: UserManager;
  private chatService: ChatService;
  private fileService: FileService;
  private logger: Logger;

  constructor(
    connection: ClientConnection,
    database: Database,
    authManager: AuthManager,
    userManager: UserManager,
    logger: Logger
  ) {
    this.database = database;
    this.authManager = authManager;
    this.userManager = userManager;
    this.chatService = new ChatService(database, userManager);
    this.fileService = new FileService(database, userManager, logger);
    this.logger = logger;
  }

  route(
    socketId: string,
    user: AuthenticatedUser | null,
    type: MessageType,
    payload: Buffer
  ): void {
    if (!EXEMPT_TYPES.includes(type) && !user) {
      throw new AuthError('需要登录才能执行此操作');
    }

    switch (type) {
      case MessageType.LOGIN_REQUEST:
        this.handleLogin(socketId, payload);
        break;

      case MessageType.REGISTER_REQUEST:
        this.handleRegister(socketId, payload);
        break;

      case MessageType.CHAT_ROOM:
        this.handleChatRoom(socketId, user!, payload);
        break;

      case MessageType.CHAT_PRIVATE:
        this.handleChatPrivate(socketId, user!, payload);
        break;

      case MessageType.ROOM_JOIN:
        this.handleRoomJoin(socketId, user!, payload);
        break;

      case MessageType.ROOM_LEAVE:
        this.handleRoomLeave(socketId, user!, payload);
        break;

      case MessageType.NICK_CHANGE:
        this.handleNickChange(socketId, user!, payload);
        break;

      case MessageType.HISTORY_REQUEST:
        this.handleHistoryRequest(socketId, user!, payload);
        break;

      case MessageType.FILE_REQUEST:
        this.handleFileRequest(socketId, user!, payload);
        break;

      case MessageType.FILE_RESPONSE:
        this.handleFileResponse(socketId, user!, payload);
        break;

      case MessageType.HEARTBEAT:
      case MessageType.HEARTBEAT_ACK:
        break;

      default:
        this.logger.warn('未知消息类型', { socketId, type });
    }
  }

  private async handleLogin(socketId: string, payload: Buffer): Promise<void> {
    const { type, payload: data } = MessageCodec.decodeJson<LoginRequest>(payload);
    const request = data;

    const user = await this.authManager.login(request);

    return;
  }

  private async handleRegister(socketId: string, payload: Buffer): Promise<void> {
    const { payload: data } = MessageCodec.decodeJson<RegisterRequest>(payload);
    const request = data;

    await this.authManager.register(request);

    return;
  }

  private handleChatRoom(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    const { payload: data } = MessageCodec.decodeJson<ChatRoomPayload & { token: string }>(payload);
    const chatPayload = data as ChatRoomPayload;

    const validation = validateMessage(chatPayload.text);
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
    }

    this.chatService.sendRoomMessage(chatPayload.room, user.userId, user.nickname, chatPayload.text);
  }

  private handleChatPrivate(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    const { payload: data } = MessageCodec.decodeJson<ChatPrivatePayload & { token: string }>(payload);
    const chatPayload = data as ChatPrivatePayload;

    const validation = validateMessage(chatPayload.text);
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
    }

    this.chatService.sendPrivateMessage(
      user.userId,
      user.nickname,
      chatPayload.target,
      chatPayload.text
    );
  }

  private handleRoomJoin(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    const { payload: data } = MessageCodec.decodeJson<RoomJoinRequest & { token: string }>(payload);
    const request = data as RoomJoinRequest;

    this.userManager.updateActiveRoom(socketId, request.roomName);
  }

  private handleRoomLeave(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    const { payload: data } = MessageCodec.decodeJson<{ roomName: string; token: string }>(payload);
    const request = data;

  }

  private handleNickChange(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    const { payload: data } = MessageCodec.decodeJson<NickChangeRequest & { token: string }>(payload);
    const request = data as NickChangeRequest;

    const success = this.userManager.updateNickname(socketId, request.newNickname);
  }

  private handleHistoryRequest(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    const { payload: data } = MessageCodec.decodeJson<HistoryRequestPayload & { token: string }>(payload);
    const request = data as HistoryRequestPayload;

  }

  private handleFileRequest(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    const { payload: data } = MessageCodec.decodeJson<FileRequestPayload & { token: string }>(payload);
    const request = data as FileRequestPayload;

  }

  private handleFileResponse(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    const { payload: data } = MessageCodec.decodeJson<FileResponsePayload>(payload);
  }
}
