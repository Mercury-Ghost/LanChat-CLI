import { Transport } from './Transport';
import { MessageCodec } from '../shared/protocol/codec';
import { MessageType } from '../shared/protocol/types';
import {
  RoomJoinRequest,
  RoomJoinResponse,
  RoomLeaveRequest,
  NickChangeRequest,
  NickChangeResponse,
  ChatRoomPayload,
  ChatPrivatePayload,
  HistoryRequestPayload,
  HistoryResponsePayload,
} from '../shared/protocol/types';
import { LocalStore } from './LocalStore';

export class CommandHandler {
  private transport: Transport;
  private localStore: LocalStore;

  constructor(transport: Transport) {
    this.transport = transport;
    this.localStore = new LocalStore();
  }

  private getToken(): string {
    return this.localStore.getToken() || '';
  }

  private getNickname(): string {
    return this.localStore.getNickname() || '';
  }

  async joinRoom(roomName: string): Promise<void> {
    const payload: RoomJoinRequest = {
      roomName,
      token: this.getToken(),
    };

    const buffer = MessageCodec.encodeJson(MessageType.ROOM_JOIN, payload);
    this.transport.send(buffer);
  }

  async leaveRoom(roomName: string): Promise<void> {
    const payload: RoomLeaveRequest = {
      roomName,
      token: this.getToken(),
    };

    const buffer = MessageCodec.encodeJson(MessageType.ROOM_LEAVE, payload);
    this.transport.send(buffer);
  }

  async changeNickname(newNickname: string): Promise<void> {
    const payload: NickChangeRequest = {
      newNickname,
      token: this.getToken(),
    };

    const buffer = MessageCodec.encodeJson(MessageType.NICK_CHANGE, payload);
    this.transport.send(buffer);
  }

  async sendRoomMessage(roomName: string, text: string): Promise<void> {
    const payload: ChatRoomPayload = {
      room: roomName,
      text,
      timestamp: new Date().toISOString(),
      sender: this.getNickname(),
      token: this.getToken(),
    };

    const buffer = MessageCodec.encodeJson(MessageType.CHAT_ROOM, payload);
    this.transport.send(buffer);
  }

  async sendPrivateMessage(targetNickname: string, text: string): Promise<void> {
    const payload: ChatPrivatePayload = {
      target: targetNickname,
      text,
      timestamp: new Date().toISOString(),
      sender: this.getNickname(),
      token: this.getToken(),
    };

    const buffer = MessageCodec.encodeJson(MessageType.CHAT_PRIVATE, payload);
    this.transport.send(buffer);
  }

  async requestHistory(roomName: string, count: number = 50): Promise<void> {
    const payload: HistoryRequestPayload = {
      room: roomName,
      type: 'room',
      count,
      token: this.getToken(),
    };

    const buffer = MessageCodec.encodeJson(MessageType.HISTORY_REQUEST, payload);
    this.transport.send(buffer);
  }

  async requestPrivateHistory(
    targetNickname: string,
    count: number = 50
  ): Promise<void> {
    const payload: HistoryRequestPayload = {
      type: 'private',
      count,
      token: this.getToken(),
    };

    const buffer = MessageCodec.encodeJson(MessageType.HISTORY_REQUEST, payload);
    this.transport.send(buffer);
  }

  async listRooms(): Promise<void> {
    const buffer = MessageCodec.encodeJson(MessageType.ROOM_LIST, {});
    this.transport.send(buffer);
  }

  async listUsers(roomName: string): Promise<void> {
    const buffer = MessageCodec.encodeJson(MessageType.USER_LIST, { room: roomName });
    this.transport.send(buffer);
  }
}
