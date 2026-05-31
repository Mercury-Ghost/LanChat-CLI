import { Logger } from 'winston';
import { Database } from './Database';
import { AuthManager } from './AuthManager';
import { UserManager } from './UserManager';
import { RoomManager } from './RoomManager';
import { ClientConnection } from './ClientConnection';
import { TlsServer } from './TlsServer';
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
  HistoryResponsePayload,
  FileRequestPayload,
  FileResponsePayload,
  FileChunkPayload,
  FileEndPayload,
  FileProgressPayload,
  AuthenticatedUser,
  ChatRoomMessage,
  ChatPrivateMessage,
  RoomListMessage,
  UserListMessage,
} from '../shared/protocol/types';
import { MessageCodec } from '../shared/protocol/codec';
import { validateMessage } from '../shared/validators';
import { AuthError, ValidationError, AppError, ErrorCode } from '../shared/errors';
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
  private roomManager: RoomManager;
  private chatService: ChatService;
  private fileService: FileService;
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
    this.chatService = new ChatService(database, userManager, roomManager, server, logger);
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

      case MessageType.FILE_CHUNK:
        this.handleFileChunk(socketId, user!, payload);
        break;

      case MessageType.FILE_END:
        this.handleFileEnd(socketId, user!, payload);
        break;

      case MessageType.FILE_PROGRESS:
        this.handleFileProgress(socketId, user!, payload);
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
  }

  private async handleLogin(socketId: string, payload: Buffer): Promise<void> {
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
  }

  private async handleRegister(socketId: string, payload: Buffer): Promise<void> {
    const { payload: data } = MessageCodec.decodeJson<RegisterRequest>(payload);
    const request = data;

    await this.authManager.register(request);

    const response: RegisterResponse = {
      success: true,
      message: '注册成功',
    };
    this.connection.sendMessage(MessageType.REGISTER_RESPONSE, response);

    this.logger.info('用户注册成功', { nickname: request.nickname });
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

    this.chatService.sendRoomMessage(
      chatPayload.room,
      user.userId,
      user.nickname,
      chatPayload.text
    );
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

    if (!this.roomManager.roomExists(request.roomName)) {
      throw new AppError(ErrorCode.ROOM_NOT_FOUND, '房间不存在');
    }

    this.userManager.updateActiveRoom(socketId, request.roomName);
    this.roomManager.joinRoom(request.roomName, user.userId);

    const response: RoomJoinResponse = {
      success: true,
      roomName: request.roomName,
    };
    this.connection.sendMessage(MessageType.ROOM_JOIN_RESPONSE, response);

    this.sendUserList();
    this.logger.info('用户加入房间', { socketId, userId: user.userId, roomName: request.roomName });
  }

  private handleRoomLeave(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    const { payload: data } = MessageCodec.decodeJson<{ roomName: string; token: string }>(payload);
    const request = data;

    if (!this.roomManager.roomExists(request.roomName)) {
      throw new AppError(ErrorCode.ROOM_NOT_FOUND, '房间不存在');
    }

    const defaultRoom = this.roomManager.getDefaultRoom();
    this.userManager.updateActiveRoom(socketId, defaultRoom);
    this.roomManager.leaveRoom(request.roomName, user.userId);

    this.sendUserList();
    this.logger.info('用户离开房间', { socketId, userId: user.userId, roomName: request.roomName });
  }

  private handleNickChange(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    const { payload: data } = MessageCodec.decodeJson<NickChangeRequest & { token: string }>(payload);
    const request = data as NickChangeRequest;

    const success = this.userManager.updateNickname(socketId, request.newNickname);

    const response: NickChangeResponse = {
      success,
      newNickname: request.newNickname,
    };
    this.connection.sendMessage(MessageType.NICK_CHANGE_RESPONSE, response);

    if (success) {
      this.sendUserList();
      this.logger.info('用户昵称修改成功', { socketId, oldNickname: user.nickname, newNickname: request.newNickname });
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

  private handleHistoryRequest(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    const { payload: data } = MessageCodec.decodeJson<HistoryRequestPayload & { token: string }>(payload);
    const request = data as HistoryRequestPayload;
    const { type, room, target, count } = request;

    try {
      let messages: HistoryResponsePayload['messages'] = [];

      if (type === 'room' && room) {
        messages = this.chatService.getRoomHistory(room, count);
      } else if (type === 'private' && target) {
        messages = this.chatService.getPrivateHistory(user.userId, target, count);
      } else {
        throw new ValidationError('无效的历史消息请求');
      }

      const response: HistoryResponsePayload = { messages };
      this.connection.sendMessage(MessageType.HISTORY_RESPONSE, response);

      this.logger.debug('历史消息请求成功', {
        socketId,
        userId: user.userId,
        type,
        room,
        target,
        messageCount: messages.length,
      });
    } catch (error) {
      this.logger.error('历史消息请求失败', {
        socketId,
        userId: user.userId,
        type,
        room,
        target,
        error,
      });
      throw error;
    }
  }

  private handleFileRequest(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    try {
      const { payload: data } = MessageCodec.decodeJson<FileRequestPayload & { token: string }>(payload);
      const request = data as FileRequestPayload;

      if (!request.targetUser && !request.room) {
        throw new ValidationError('必须指定目标用户或房间');
      }

      const session = this.fileService.initiateTransfer(request, user.userId);

      const forwardPayload: FileRequestPayload & { transferId: string; sender: string } = {
        ...request,
        transferId: session.transferId,
        sender: user.nickname,
      };

      if (request.targetUser) {
        const targetUser = this.userManager.getUserByNickname(request.targetUser);
        if (!targetUser) {
          throw new AppError(ErrorCode.USER_NOT_FOUND, '目标用户不在线');
        }
        const targetConnection = this.server.getConnection(targetUser.socketId);
        if (targetConnection) {
          targetConnection.sendMessage(MessageType.FILE_REQUEST, forwardPayload);
        }
        this.logger.info('文件请求已转发给用户', {
          socketId,
          transferId: session.transferId,
          sender: user.nickname,
          target: request.targetUser,
        });
      } else if (request.room) {
        this.server.broadcastToRoom(
          request.room,
          MessageCodec.encodeJson(MessageType.FILE_REQUEST, forwardPayload),
          [socketId]
        );
        this.logger.info('文件请求已广播到房间', {
          socketId,
          transferId: session.transferId,
          sender: user.nickname,
          room: request.room,
        });
      }
    } catch (error) {
      this.logger.error('处理文件请求失败', { socketId, error });
      throw error;
    }
  }

  private handleFileResponse(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    try {
      const { payload: data } = MessageCodec.decodeJson<FileResponsePayload>(payload);
      const response = data as FileResponsePayload;

      const session = this.fileService.getSession(response.transferId);
      if (!session) {
        throw new ValidationError('传输会话不存在');
      }

      if (response.accepted) {
        this.fileService.acceptTransfer(response.transferId, user.userId);

        const forwardPayload: FileResponsePayload & { acceptor: string } = {
          ...response,
          acceptor: user.nickname,
        };

        const senderUser = this.userManager.getUserByNickname(
          Array.from(this.userManager.getOnlineUsers()).find(
            (u) => u.userId === session.senderId
          )?.nickname || ''
        );

        if (senderUser) {
          const senderConnection = this.server.getConnection(senderUser.socketId);
          if (senderConnection) {
            senderConnection.sendMessage(MessageType.FILE_RESPONSE, forwardPayload);
          }
        }

        this.logger.info('文件传输已接受', {
          socketId,
          transferId: response.transferId,
          acceptor: user.nickname,
        });
      } else {
        this.fileService.rejectTransfer(response.transferId, user.userId, response.reason);

        const forwardPayload: FileResponsePayload & { rejector: string } = {
          ...response,
          rejector: user.nickname,
        };

        const senderUser = this.userManager.getUserByNickname(
          Array.from(this.userManager.getOnlineUsers()).find(
            (u) => u.userId === session.senderId
          )?.nickname || ''
        );

        if (senderUser) {
          const senderConnection = this.server.getConnection(senderUser.socketId);
          if (senderConnection) {
            senderConnection.sendMessage(MessageType.FILE_RESPONSE, forwardPayload);
          }
        }

        this.logger.info('文件传输已拒绝', {
          socketId,
          transferId: response.transferId,
          rejector: user.nickname,
          reason: response.reason,
        });
      }
    } catch (error) {
      this.logger.error('处理文件响应失败', { socketId, error });
      throw error;
    }
  }

  private handleFileChunk(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    try {
      const { payload: data } = MessageCodec.decodeJson<FileChunkPayload>(payload);
      const chunkPayload = data as FileChunkPayload;

      const session = this.fileService.getSession(chunkPayload.transferId);
      if (!session) {
        throw new ValidationError('传输会话不存在');
      }

      const chunkData = Buffer.from(chunkPayload.data, 'base64');
      this.fileService.receiveChunk(
        chunkPayload.transferId,
        chunkPayload.chunkIndex,
        chunkData
      );

      const progress = this.fileService.getProgress(chunkPayload.transferId);
      const progressPayload: FileProgressPayload = {
        transferId: chunkPayload.transferId,
        receivedBytes: (chunkPayload.chunkIndex + 1) * 64 * 1024,
        totalBytes: session.fileSize,
      };

      const senderUser = Array.from(this.userManager.getOnlineUsers()).find(
        (u) => u.userId === session.senderId
      );
      if (senderUser) {
        const senderConnection = this.server.getConnection(senderUser.socketId);
        if (senderConnection) {
          senderConnection.sendMessage(MessageType.FILE_PROGRESS, progressPayload);
        }
      }

      this.logger.debug('接收文件块', {
        socketId,
        transferId: chunkPayload.transferId,
        chunkIndex: chunkPayload.chunkIndex,
        progress,
      });
    } catch (error) {
      this.logger.error('处理文件块失败', { socketId, error });
      throw error;
    }
  }

  private handleFileEnd(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    try {
      const { payload: data } = MessageCodec.decodeJson<FileEndPayload>(payload);
      const endPayload = data as FileEndPayload;

      const session = this.fileService.getSession(endPayload.transferId);
      if (!session) {
        throw new ValidationError('传输会话不存在');
      }

      if (endPayload.status === 'success') {
        const storedPath = this.fileService.completeTransfer(endPayload.transferId);

        const forwardPayload: FileEndPayload & { storedPath?: string } = {
          ...endPayload,
          storedPath,
        };

        if (session.receiverId) {
          const receiverUser = Array.from(this.userManager.getOnlineUsers()).find(
            (u) => u.userId === session.receiverId
          );
          if (receiverUser) {
            const receiverConnection = this.server.getConnection(receiverUser.socketId);
            if (receiverConnection) {
              receiverConnection.sendMessage(MessageType.FILE_END, forwardPayload);
            }
          }
        } else if (session.roomId) {
          const room = this.roomManager.getAllRooms().find((r) => r.id === session.roomId);
          if (room) {
            this.server.broadcastToRoom(
              room.name,
              MessageCodec.encodeJson(MessageType.FILE_END, forwardPayload)
            );
          }
        }

        this.logger.info('文件传输完成', {
          socketId,
          transferId: endPayload.transferId,
          storedPath,
        });
      } else {
        this.fileService.abortTransfer(endPayload.transferId, endPayload.reason);

        const forwardPayload: FileEndPayload = {
          ...endPayload,
        };

        if (session.receiverId) {
          const receiverUser = Array.from(this.userManager.getOnlineUsers()).find(
            (u) => u.userId === session.receiverId
          );
          if (receiverUser) {
            const receiverConnection = this.server.getConnection(receiverUser.socketId);
            if (receiverConnection) {
              receiverConnection.sendMessage(MessageType.FILE_END, forwardPayload);
            }
          }
        } else if (session.roomId) {
          const room = this.roomManager.getAllRooms().find((r) => r.id === session.roomId);
          if (room) {
            this.server.broadcastToRoom(
              room.name,
              MessageCodec.encodeJson(MessageType.FILE_END, forwardPayload)
            );
          }
        }

        this.logger.info('文件传输中止', {
          socketId,
          transferId: endPayload.transferId,
          reason: endPayload.reason,
        });
      }
    } catch (error) {
      this.logger.error('处理文件结束失败', { socketId, error });
      throw error;
    }
  }

  private handleFileProgress(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    try {
      const { payload: data } = MessageCodec.decodeJson<FileProgressPayload>(payload);
      const progressPayload = data as FileProgressPayload;

      const session = this.fileService.getSession(progressPayload.transferId);
      if (!session) {
        throw new ValidationError('传输会话不存在');
      }

      if (session.receiverId) {
        const receiverUser = Array.from(this.userManager.getOnlineUsers()).find(
          (u) => u.userId === session.receiverId
        );
        if (receiverUser) {
          const receiverConnection = this.server.getConnection(receiverUser.socketId);
          if (receiverConnection) {
            receiverConnection.sendMessage(MessageType.FILE_PROGRESS, progressPayload);
          }
        }
      } else if (session.roomId) {
        const room = this.roomManager.getAllRooms().find((r) => r.id === session.roomId);
        if (room) {
          this.server.broadcastToRoom(
            room.name,
            MessageCodec.encodeJson(MessageType.FILE_PROGRESS, progressPayload)
          );
        }
      }
    } catch (error) {
      this.logger.error('处理文件进度失败', { socketId, error });
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
