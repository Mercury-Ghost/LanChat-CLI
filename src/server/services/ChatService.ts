import { Database } from '../Database';
import { UserManager } from '../UserManager';
import { RoomManager } from '../RoomManager';
import { TlsServer } from '../TlsServer';
import { Logger } from 'winston';
import { MessageRepo } from '../repositories/MessageRepo';
import { RoomRepo } from '../repositories/RoomRepo';
import { UserRepo } from '../repositories/UserRepo';
import { DEFAULT_HISTORY_COUNT, DEFAULT_ROOM_NAME } from '../../shared/constants';
import {
  ChatRoomPayload,
  ChatPrivatePayload,
  HistoryMessage,
  ChatRoomMessage,
  ChatPrivateMessage,
  MessageType,
} from '../../shared/protocol/types';
import { ValidationError } from '../../shared/errors';
import { MessageCodec } from '../../shared/protocol/codec';

export class ChatService {
  private database: Database;
  private userManager: UserManager;
  private roomManager: RoomManager;
  private server: TlsServer;
  private messageRepo: MessageRepo;
  private roomRepo: RoomRepo;
  private userRepo: UserRepo;
  private logger: Logger;

  constructor(
    database: Database,
    userManager: UserManager,
    roomManager: RoomManager,
    server: TlsServer,
    logger: Logger
  ) {
    this.database = database;
    this.userManager = userManager;
    this.roomManager = roomManager;
    this.server = server;
    this.messageRepo = new MessageRepo(database);
    this.roomRepo = new RoomRepo(database);
    this.userRepo = new UserRepo(database);
    this.logger = logger;
  }

  sendRoomMessage(
    roomName: string,
    senderId: number,
    senderNickname: string,
    content: string
  ): number {
    const room = this.roomRepo.findByName(roomName);
    if (!room) {
      throw new ValidationError('房间不存在');
    }

    const messageId = this.messageRepo.createRoomMessage(
      room.id,
      senderId,
      content
    );

    const chatMessage: ChatRoomMessage = {
      room: roomName,
      sender: senderNickname,
      text: content,
      timestamp: new Date().toISOString(),
    };

    this.server.broadcastToRoom(
      roomName,
      MessageCodec.encodeJson(MessageType.CHAT_ROOM, chatMessage)
    );

    this.logger.debug('房间消息发送', { roomName, senderId, senderNickname, content });

    return messageId;
  }

  sendPrivateMessage(
    senderId: number,
    senderNickname: string,
    targetNickname: string,
    content: string
  ): number {
    const targetUser = this.userManager.getUserByNickname(targetNickname);
    if (!targetUser) {
      throw new ValidationError('目标用户不在线');
    }

    const messageId = this.messageRepo.createPrivateMessage(
      senderId,
      targetUser.userId,
      content
    );

    const chatMessage: ChatPrivateMessage = {
      from: senderNickname,
      text: content,
      timestamp: new Date().toISOString(),
    };

    const targetConnection = this.server.getConnection(targetUser.socketId);
    if (targetConnection) {
      targetConnection.sendMessage(MessageType.CHAT_PRIVATE, chatMessage);
    }

    this.logger.debug('私聊消息发送', { senderId, senderNickname, targetNickname, content });

    return messageId;
  }

  getRoomHistory(
    roomName: string,
    count: number = DEFAULT_HISTORY_COUNT
  ): HistoryMessage[] {
    const room = this.roomRepo.findByName(roomName);
    if (!room) {
      throw new ValidationError('房间不存在');
    }

    const messages = this.messageRepo.getRoomHistory(room.id, count);

    return messages
      .reverse()
      .map((msg) => ({
        sender: msg.sender_nickname,
        content: msg.content,
        timestamp: msg.timestamp,
      }));
  }

  getPrivateHistory(
    currentUserId: number,
    targetNickname: string,
    count: number = DEFAULT_HISTORY_COUNT
  ): HistoryMessage[] {
    const targetUser = this.userRepo.findByNickname(targetNickname);
    if (!targetUser) {
      throw new ValidationError('目标用户不存在');
    }

    const messages = this.messageRepo.getPrivateHistory(
      currentUserId,
      targetUser.id,
      count
    );

    return messages
      .reverse()
      .map((msg) => ({
        sender: msg.sender_nickname,
        content: msg.content,
        timestamp: msg.timestamp,
      }));
  }

  sendSystemMessage(roomName: string, content: string): void {
    const room = this.roomRepo.findByName(roomName);
    if (!room) {
      return;
    }

    this.messageRepo.createRoomMessage(room.id, 0, content, 'system');
  }
}
