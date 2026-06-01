import { Logger } from 'winston';
import { UserManager } from '../UserManager';
import { RoomManager } from '../RoomManager';
import { ClientConnection } from '../ClientConnection';
import { TlsServer } from '../TlsServer';
import { MessageType } from '../../shared/protocol/types';
import {
  NickChangeRequest,
  NickChangeResponse,
  AuthenticatedUser,
  UserListMessage,
} from '../../shared/protocol/types';
import { MessageCodec } from '../../shared/protocol/codec';

export class UserProfileHandler {
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

  handleNickChange(
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

  private sendUserList(): void {
    const users = this.userManager.getOnlineUsers();
    const message: UserListMessage = { users };
    this.server.broadcast(MessageCodec.encodeJson(MessageType.USER_LIST, message));
  }
}
