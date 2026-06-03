import { EventEmitter } from 'events';
import { Transport } from './Transport';
import { TlsTransport, CertificateVerifyCallback } from './TlsTransport';
import { AuthClient } from './AuthClient';
import { CommandHandler } from './CommandHandler';
import { FileTransferClient } from './FileTransferClient';
import { LocalStore } from './LocalStore';
import { MessageCodec } from '../shared/protocol/codec';
import { MessageType } from '../shared/protocol/types';
import {
  LoginResponse,
  RegisterResponse,
  ChatRoomPayload,
  ChatPrivatePayload,
  ChatSystemPayload,
  UserListPayload,
  RoomListPayload,
  ErrorPayload,
  OnlineUser,
} from '../shared/protocol/types';
import { TuiManager } from './TuiManager';

/**
 * 客户端连接状态枚举
 * 
 * @description 定义客户端与服务器之间的各种连接状态，用于跟踪和管理连接生命周期
 * 
 * @example
 * ```typescript
 * const state = client.getState();
 * if (state === ConnectionState.Authenticated) {
 *   console.log('用户已登录');
 * }
 * ```
 */
export enum ConnectionState {
    /** 初始状态，未连接 */
    Disconnected = 'Disconnected',
    /** 正在建立连接 */
    Connecting = 'Connecting',
    /** 已建立 TCP 连接 */
    Connected = 'Connected',
    /** 已完成认证 */
    Authenticated = 'Authenticated',
    /** 正在尝试重连 */
    Reconnecting = 'Reconnecting',
}

/**
 * 聊天客户端核心类
 * 
 * @description 这是 LanChat CLI 客户端的核心类，负责管理与聊天服务器的通信连接。
 *              客户端处理用户认证、消息路由、房间管理、文件传输和 UI 更新等主要功能。
 *              继承自 EventEmitter，支持事件驱动的消息通知。
 * 
 * @example
 * ```typescript
 * const client = new ChatClient();
 * 
 * // 监听消息事件
 * client.on('message', (msg) => {
 *   console.log(`收到消息: ${msg.content}`);
 * });
 * 
 * // 监听错误事件
 * client.on('error', (err) => {
 *   console.error('错误:', err.message);
 * });
 * 
 * // 连接并登录
 * await client.connect('localhost', 9527);
 * await client.login('user', 'pass');
 * ```
 */
export class ChatClient extends EventEmitter {
  /** 传输层实例 */
  private transport: Transport;
    
  /** 认证客户端实例 */
  private authClient: AuthClient;
    
  /** 命令处理器实例 */
  private commandHandler: CommandHandler;
    
  /** 文件传输客户端实例 */
  private fileTransferClient: FileTransferClient;
    
  /** 本地存储实例 */
  private localStore: LocalStore;
    
  /** TUI 管理器实例（可选） */
  private tui: TuiManager | null = null;
    
  /** 当前连接状态 */
  private state: ConnectionState = ConnectionState.Disconnected;
    
  /** 当前重连尝试次数 */
  private reconnectAttempts: number = 0;
    
  /** 最大重连尝试次数 */
  private maxReconnectAttempts: number = 5;
    
  /** 当前所在房间 */
  private currentRoom: string = '#general';
    
  /** 当前房间的在线用户列表 */
  private onlineUsers: OnlineUser[] = [];

  /**
     * 构造函数
     * 
     * @description 初始化客户端，创建所有必要的子模块实例并设置事件监听
     */
  constructor() {
    super();
    this.transport = new TlsTransport();
    this.authClient = new AuthClient(this.transport);
    this.commandHandler = new CommandHandler(this.transport);
    this.fileTransferClient = new FileTransferClient(this.transport);
    this.localStore = new LocalStore();

    this.setupTransportHandlers();
  }

  /**
     * 设置 TUI 管理器
     * 
     * @param tui - TUI 管理器实例
     * 
     * @description 关联 TUI 管理器，以便客户端可以更新用户界面
     */
  setTui(tui: TuiManager): void {
    this.tui = tui;
  }

  /**
     * 设置传输层事件处理器
     * 
     * @private
     * @description 监听传输层的连接、消息、错误和关闭事件
     */
  private setupTransportHandlers(): void {
    this.transport.on('message', (buffer: Buffer) => {
      this.handleMessage(buffer);
    });

    this.transport.on('close', () => {
      this.emit('close');
    });

    this.transport.on('error', (error: Error) => {
      this.emit('error', error);
    });

    this.transport.on('connect', () => {
      this.state = ConnectionState.Connected;
      this.emit('connect');
    });
  }

  /**
     * 处理接收到的消息
     * 
     * @private
     * @param buffer - 消息缓冲区
     * 
     * @description 解码并分发接收到的消息到对应的处理器
     *              支持登录响应、注册响应、群聊消息、私聊消息、系统消息等
     * 
     * @throws {Error} 消息解码失败时抛出错误
     */
  private handleMessage(buffer: Buffer): void {
    try {
      const { type, payload } = MessageCodec.decode(buffer);

      switch (type) {
      case MessageType.LOGIN_RESPONSE:
        this.handleLoginResponse(payload);
        break;

      case MessageType.REGISTER_RESPONSE:
        this.handleRegisterResponse(payload);
        break;

      case MessageType.CHAT_ROOM:
        this.handleChatRoom(payload);
        break;

      case MessageType.CHAT_PRIVATE:
        this.handleChatPrivate(payload);
        break;

      case MessageType.CHAT_SYSTEM:
        this.handleChatSystem(payload);
        break;

      case MessageType.USER_LIST:
        this.handleUserList(payload);
        break;

      case MessageType.ROOM_LIST:
        this.handleRoomList(payload);
        break;

      case MessageType.ERROR:
        this.handleError(payload);
        break;

      case MessageType.FILE_RESPONSE:
        this.fileTransferClient.handleFileResponse(payload);
        break;

      case MessageType.FILE_CHUNK:
        this.fileTransferClient.handleFileChunk(payload);
        break;

      case MessageType.FILE_END:
        this.fileTransferClient.handleFileEnd(payload);
        break;

      case MessageType.FILE_PROGRESS:
        this.fileTransferClient.handleFileProgress(payload);
        break;

      default:
        break;
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
     * 处理登录响应
     * 
     * @private
     * @param payload - 登录响应数据
     * 
     * @description 解析登录响应，成功时保存令牌和昵称并更新状态
     * 
     * @example
     * ```typescript
     * // 服务器返回成功响应后自动调用
     * this.handleLoginResponse(responsePayload);
     * ```
     */
  private handleLoginResponse(payload: Buffer): void {
    const response = JSON.parse(payload.toString()) as LoginResponse;

    if (response.success && response.token) {
      this.localStore.saveToken(response.token);
      if (response.nickname) {
        this.localStore.saveNickname(response.nickname);
      }
      this.state = ConnectionState.Authenticated;
      this.emit('authenticated');
    } else {
      this.emit('error', new Error(response.error || '登录失败'));
    }
  }

  /**
     * 处理注册响应
     * 
     * @private
     * @param payload - 注册响应数据
     * 
     * @description 解析注册响应，失败时发出错误事件
     */
  private handleRegisterResponse(payload: Buffer): void {
    const response = JSON.parse(payload.toString()) as RegisterResponse;

    if (!response.success) {
      this.emit('error', new Error(response.error || '注册失败'));
    }
  }

  /**
     * 处理群聊消息
     * 
     * @private
     * @param payload - 群聊消息数据
     * 
     * @description 解析群聊消息并通过事件发出
     */
  private handleChatRoom(payload: Buffer): void {
    const message = JSON.parse(payload.toString()) as ChatRoomPayload;
    this.emit('message', {
      type: 'room',
      room: message.room,
      sender: message.sender,
      content: message.text,
      timestamp: message.timestamp,
    });
  }

  /**
     * 处理私聊消息
     * 
     * @private
     * @param payload - 私聊消息数据
     * 
     * @description 解析私聊消息并通过事件发出
     */
  private handleChatPrivate(payload: Buffer): void {
    const message = JSON.parse(payload.toString()) as ChatPrivatePayload;
    this.emit('message', {
      type: 'private',
      sender: message.sender,
      content: message.text,
      timestamp: message.timestamp,
    });
  }

  /**
     * 处理系统消息
     * 
     * @private
     * @param payload - 系统消息数据
     * 
     * @description 解析系统消息并通过事件发出
     */
  private handleChatSystem(payload: Buffer): void {
    const message = JSON.parse(payload.toString()) as ChatSystemPayload;
    this.emit('message', {
      type: 'system',
      content: message.text,
      timestamp: message.timestamp,
    });
  }

  /**
     * 处理用户列表更新
     * 
     * @private
     * @param payload - 用户列表数据
     * 
     * @description 解析用户列表，更新本地缓存并刷新 TUI 显示
     */
  private handleUserList(payload: Buffer): void {
    const data = JSON.parse(payload.toString()) as UserListPayload;
    this.onlineUsers = data.users;
    this.tui?.updateUserList(this.onlineUsers);
  }

  /**
     * 处理房间列表更新
     * 
     * @private
     * @param payload - 房间列表数据
     * 
     * @description 解析房间列表并刷新 TUI 显示
     */
  private handleRoomList(payload: Buffer): void {
    const data = JSON.parse(payload.toString()) as RoomListPayload;
    this.tui?.updateRoomList(data.rooms);
  }

  /**
     * 处理错误消息
     * 
     * @private
     * @param payload - 错误消息数据
     * 
     * @description 解析错误消息并通过错误事件发出
     */
  private handleError(payload: Buffer): void {
    const error = JSON.parse(payload.toString()) as ErrorPayload;
    this.emit('error', new Error(error.message));
  }

  /**
     * 连接到聊天服务器
     * 
     * @param host - 服务器主机地址
     * @param port - 服务器端口号
     * @param verifyCallback - 证书验证回调函数（可选）
     * @returns {Promise<void>} 连接成功后 resolve
     * @throws {Error} 连接失败时抛出错误
     * 
     * @example
     * ```typescript
     * try {
     *   await client.connect('192.168.1.100', 9527, async (fingerprint, isFirst) => {
     *     if (isFirst) {
     *       return confirm('信任此证书?');
     *     }
     *     return true;
     *   });
     *   console.log('连接成功');
     * } catch (error) {
     *   console.error('连接失败:', error.message);
     * }
     * ```
     */
  async connect(
    host: string, 
    port: number, 
    verifyCallback?: CertificateVerifyCallback
  ): Promise<void> {
    this.state = ConnectionState.Connecting;

    try {
      if (verifyCallback && 'connect' in this.transport) {
        await (this.transport as TlsTransport).connect(host, port, verifyCallback);
      } else {
        await this.transport.connect(host, port);
      }
            
      this.state = ConnectionState.Connected;

      const savedToken = this.localStore.getToken();
      if (savedToken) {
        this.state = ConnectionState.Authenticated;
        this.emit('authenticated');
      }
    } catch (error) {
      this.state = ConnectionState.Disconnected;
      throw error;
    }
  }

  /**
     * 用户登录
     * 
     * @param nickname - 用户昵称
     * @param password - 用户密码
     * @returns {Promise<void>} 登录成功后 resolve
     * 
     * @description 通过认证客户端发起登录请求
     */
  async login(nickname: string, password: string): Promise<void> {
    return await this.authClient.login(nickname, password);
  }

  /**
     * 用户注册
     * 
     * @param nickname - 选择的昵称
     * @param password - 设置的密码
     * @returns {Promise<void>} 注册成功后 resolve
     * 
     * @description 通过认证客户端发起注册请求
     */
  async register(nickname: string, password: string): Promise<void> {
    return await this.authClient.register(nickname, password);
  }

  /**
     * 发送群聊消息
     * 
     * @param text - 消息内容
     * @returns {Promise<void>} 消息发送成功后 resolve
     * 
     * @description 向当前所在房间发送消息
     * 
     * @example
     * ```typescript
     * await client.sendRoomMessage('大家好！');
     * ```
     */
  async sendRoomMessage(text: string): Promise<void> {
    return await this.commandHandler.sendRoomMessage(this.currentRoom, text);
  }

  /**
     * 发送私聊消息
     * 
     * @param target - 目标用户昵称
     * @param text - 消息内容
     * @returns {Promise<void>} 消息发送成功后 resolve
     * 
     * @description 向指定用户发送私聊消息
     * 
     * @example
     * ```typescript
     * await client.sendPrivateMessage('alice', '在吗？');
     * ```
     */
  async sendPrivateMessage(target: string, text: string): Promise<void> {
    return await this.commandHandler.sendPrivateMessage(target, text);
  }

  /**
     * 加入聊天室
     * 
     * @param roomName - 房间名称
     * @returns {Promise<void>} 加入成功后 resolve
     * 
     * @description 加入指定聊天室，更新当前房间状态
     * 
     * @example
     * ```typescript
     * await client.joinRoom('#general');
     * ```
     */
  async joinRoom(roomName: string): Promise<void> {
    await this.commandHandler.joinRoom(roomName);
    this.currentRoom = roomName;
  }

  /**
     * 离开当前聊天室
     * 
     * @returns {Promise<void>} 离开成功后 resolve
     * 
     * @description 离开当前所在的聊天室
     */
  async leaveRoom(): Promise<void> {
    await this.commandHandler.leaveRoom(this.currentRoom);
  }

  /**
     * 修改用户昵称
     * 
     * @param newNickname - 新昵称
     * @returns {Promise<void>} 修改成功后 resolve
     * 
     * @description 向服务器请求修改当前用户的昵称
     */
  async changeNickname(newNickname: string): Promise<void> {
    await this.commandHandler.changeNickname(newNickname);
  }

  /**
     * 请求聊天历史记录
     * 
     * @param count - 要获取的消息数量（默认 50，最大 200）
     * @returns {Promise<void>} 请求成功后 resolve
     * 
     * @description 请求获取当前房间的聊天历史消息
     */
  async requestHistory(count: number = 50): Promise<void> {
    await this.commandHandler.requestHistory(this.currentRoom, count);
  }

  /**
     * 发送文件
     * 
     * @param target - 目标用户昵称
     * @param filePath - 文件路径
     * @returns {Promise<void>} 文件发送成功后 resolve
     * @throws {Error} 文件不存在或大小超限时抛出错误
     * 
     * @description 向指定用户发送文件，支持断点续传
     * 
     * @example
     * ```typescript
     * try {
     *   await client.sendFile('alice', '/path/to/file.pdf');
     *   console.log('文件发送成功');
     * } catch (error) {
     *   console.error('发送失败:', error.message);
     * }
     * ```
     */
  async sendFile(target: string, filePath: string): Promise<void> {
    await this.fileTransferClient.sendFile(target, filePath);
  }

  /**
     * 获取当前连接状态
     * 
     * @returns {ConnectionState} 当前连接状态
     */
  getState(): ConnectionState {
    return this.state;
  }

  /**
     * 获取当前所在房间
     * 
     * @returns {string} 当前房间名称
     */
  getCurrentRoom(): string {
    return this.currentRoom;
  }

  /**
     * 获取当前房间的在线用户列表
     * 
     * @returns {OnlineUser[]} 在线用户数组
     */
  getOnlineUsers(): OnlineUser[] {
    return this.onlineUsers;
  }

  /**
     * 断开连接
     * 
     * @returns {Promise<void>} 断开成功后 resolve
     * 
     * @description 优雅地关闭与服务器的连接，更新连接状态
     */
  async disconnect(): Promise<void> {
    this.transport.close();
    this.state = ConnectionState.Disconnected;
  }
}
