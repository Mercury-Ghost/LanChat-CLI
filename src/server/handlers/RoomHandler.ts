import { Logger } from 'winston';
import { UserManager } from '../UserManager';
import { RoomManager } from '../RoomManager';
import { ClientConnection } from '../ClientConnection';
import { TlsServer } from '../TlsServer';
import { MessageType } from '../../shared/protocol/types';
import {
  RoomJoinRequest,
  RoomJoinResponse,
  AuthenticatedUser,
  UserListMessage,
} from '../../shared/protocol/types';
import { MessageCodec } from '../../shared/protocol/codec';
import { AppError, ErrorCode } from '../../shared/errors';

export class RoomHandler {
  private userManager: UserManager;
  private roomManager: RoomManager;
  private connection: ClientConnection;
  private server: TlsServer;
  private logger: Logger;

  constructor(
    connection: ClientConnection,
    userManager: UserManager,
    roomManager: RoomManager,
    server: TlsServer,
    logger: Logger
  ) {
    this.connection = connection;
    this.userManager = userManager;
    this.roomManager = roomManager;
    this.server = server;
    this.logger = logger;
  }

  handleRoomJoin(
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

  handleRoomLeave(
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

  private sendUserList(): void {
    const users = this.userManager.getOnlineUsers();
    const message: UserListMessage = { users };
    this.server.broadcast(MessageCodec.encodeJson(MessageType.USER_LIST, message));
  }
}
