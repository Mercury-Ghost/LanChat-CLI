import { Database } from '../Database';
import { UserManager } from '../UserManager';
import { MessageRepo } from '../repositories/MessageRepo';
import { RoomRepo } from '../repositories/RoomRepo';
import { DEFAULT_HISTORY_COUNT, DEFAULT_ROOM_NAME } from '../../shared/constants';
import { ChatRoomPayload, ChatPrivatePayload, HistoryMessage } from '../../shared/protocol/types';
import { ValidationError } from '../../shared/errors';

export class ChatService {
  private database: Database;
  private userManager: UserManager;
  private messageRepo: MessageRepo;
  private roomRepo: RoomRepo;

  constructor(database: Database, userManager: UserManager) {
    this.database = database;
    this.userManager = userManager;
    this.messageRepo = new MessageRepo(database);
    this.roomRepo = new RoomRepo(database);
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
    const targetUser = this.userManager.getUserByNickname(targetNickname);
    if (!targetUser) {
      throw new ValidationError('目标用户不在线');
    }

    const messages = this.messageRepo.getPrivateHistory(
      currentUserId,
      targetUser.userId,
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
