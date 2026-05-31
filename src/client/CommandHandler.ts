import { Transport } from './Transport';
import { MessageCodec } from '../shared/protocol/codec';
import { MessageType } from '../shared/protocol/types';
import {
  RoomJoinRequest,
  RoomLeaveRequest,
  NickChangeRequest,
  ChatRoomPayload,
  ChatPrivatePayload,
  HistoryRequestPayload,
} from '../shared/protocol/types';
import { LocalStore } from './LocalStore';

/**
 * 命令处理器类
 * 
 * @description 负责处理各种聊天命令，包括消息发送、房间管理、用户列表查询等
 *              通过传输层与服务器进行通信
 * 
 * @example
 * ```typescript
 * const handler = new CommandHandler(transport);
 * 
 * // 发送消息
 * await handler.sendRoomMessage('#general', 'Hello everyone!');
 * 
 * // 加入房间
 * await handler.joinRoom('#general');
 * ```
 */
export class CommandHandler {
  /** 传输层实例 */
  private transport: Transport;
  
  /** 本地存储实例 */
  private localStore: LocalStore;

  /**
   * 构造函数
   * 
   * @param transport - 传输层实例
   */
  constructor(transport: Transport) {
    this.transport = transport;
    this.localStore = new LocalStore();
  }

  /**
   * 获取认证令牌
   * 
   * @private
   * @returns {string} 令牌字符串，如果不存在则返回空字符串
   */
  private getToken(): string {
    return this.localStore.getToken() || '';
  }

  /**
   * 获取当前昵称
   * 
   * @private
   * @returns {string} 当前昵称，如果不存在则返回空字符串
   */
  private getNickname(): string {
    return this.localStore.getNickname() || '';
  }

  /**
   * 加入聊天室
   * 
   * @param roomName - 房间名称
   * @returns {Promise<void>} 请求发送成功后 resolve
   * 
   * @description 向服务器发送加入房间请求
   */
  async joinRoom(roomName: string): Promise<void> {
    const payload: RoomJoinRequest = {
      roomName,
      token: this.getToken(),
    };

    const buffer = MessageCodec.encodeJson(MessageType.ROOM_JOIN, payload);
    this.transport.send(buffer);
  }

  /**
   * 离开聊天室
   * 
   * @param roomName - 房间名称
   * @returns {Promise<void>} 请求发送成功后 resolve
   * 
   * @description 向服务器发送离开房间请求
   */
  async leaveRoom(roomName: string): Promise<void> {
    const payload: RoomLeaveRequest = {
      roomName,
      token: this.getToken(),
    };

    const buffer = MessageCodec.encodeJson(MessageType.ROOM_LEAVE, payload);
    this.transport.send(buffer);
  }

  /**
   * 修改用户昵称
   * 
   * @param newNickname - 新昵称
   * @returns {Promise<void>} 请求发送成功后 resolve
   * 
   * @description 向服务器发送昵称修改请求
   */
  async changeNickname(newNickname: string): Promise<void> {
    const payload: NickChangeRequest = {
      newNickname,
      token: this.getToken(),
    };

    const buffer = MessageCodec.encodeJson(MessageType.NICK_CHANGE, payload);
    this.transport.send(buffer);
  }

  /**
   * 发送群聊消息
   * 
   * @param roomName - 目标房间名称
   * @param text - 消息内容
   * @returns {Promise<void>} 消息发送成功后 resolve
   * 
   * @description 向指定房间发送群聊消息
   */
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

  /**
   * 发送私聊消息
   * 
   * @param targetNickname - 目标用户昵称
   * @param text - 消息内容
   * @returns {Promise<void>} 消息发送成功后 resolve
   * 
   * @description 向指定用户发送私聊消息
   */
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

  /**
   * 请求聊天历史记录
   * 
   * @param roomName - 房间名称
   * @param count - 要获取的消息数量（默认 50，最大 200）
   * @returns {Promise<void>} 请求发送成功后 resolve
   * 
   * @description 请求获取指定房间的聊天历史消息
   */
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

  /**
   * 请求私聊历史记录
   * 
   * @param targetNickname - 目标用户昵称
   * @param count - 要获取的消息数量（默认 50，最大 200）
   * @returns {Promise<void>} 请求发送成功后 resolve
   * 
   * @description 请求获取与指定用户的私聊历史消息
   */
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

  /**
   * 获取房间列表
   * 
   * @returns {Promise<void>} 请求发送成功后 resolve
   * 
   * @description 向服务器请求可用房间列表
   */
  async listRooms(): Promise<void> {
    const buffer = MessageCodec.encodeJson(MessageType.ROOM_LIST, {});
    this.transport.send(buffer);
  }

  /**
   * 获取房间用户列表
   * 
   * @param roomName - 房间名称
   * @returns {Promise<void>} 请求发送成功后 resolve
   * 
   * @description 向服务器请求指定房间的在线用户列表
   */
  async listUsers(roomName: string): Promise<void> {
    const buffer = MessageCodec.encodeJson(MessageType.USER_LIST, { room: roomName });
    this.transport.send(buffer);
  }
}
