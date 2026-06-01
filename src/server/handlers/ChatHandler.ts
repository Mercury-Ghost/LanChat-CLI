import { Logger } from 'winston';
import { ClientConnection } from '../ClientConnection';
import {
  AuthenticatedUser,
  ChatRoomPayload,
  ChatPrivatePayload,
  HistoryRequestPayload,
  HistoryResponsePayload,
  MessageType,
} from '../../shared/protocol/types';
import { MessageCodec } from '../../shared/protocol/codec';
import { validateMessage } from '../../shared/validators';
import { ValidationError } from '../../shared/errors';
import { ChatService } from '../services/ChatService';

export class ChatHandler {
  private chatService: ChatService;
  private connection: ClientConnection;
  private logger: Logger;

  constructor(
    connection: ClientConnection,
    chatService: ChatService,
    logger: Logger
  ) {
    this.connection = connection;
    this.chatService = chatService;
    this.logger = logger;
  }

  handleChatRoom(
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

  handleChatPrivate(
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

  handleHistoryRequest(
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
}
