import { EventEmitter } from 'events';
import { Transport } from './Transport';
import { TlsTransport } from './TlsTransport';
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
  HistoryResponsePayload,
  FileRequestPayload,
  FileResponsePayload,
  FileChunkPayload,
  FileEndPayload,
  FileProgressPayload,
  ErrorPayload,
  OnlineUser,
} from '../shared/protocol/types';
import { TuiManager } from './TuiManager';

export enum ConnectionState {
  Disconnected = 'Disconnected',
  Connecting = 'Connecting',
  Connected = 'Connected',
  Authenticated = 'Authenticated',
  Reconnecting = 'Reconnecting',
}

export class ChatClient extends EventEmitter {
  private transport: Transport;
  private authClient: AuthClient;
  private commandHandler: CommandHandler;
  private fileTransferClient: FileTransferClient;
  private localStore: LocalStore;
  private tui: TuiManager | null = null;
  private state: ConnectionState = ConnectionState.Disconnected;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private currentRoom: string = '#general';
  private onlineUsers: OnlineUser[] = [];

  constructor() {
    super();
    this.transport = new TlsTransport();
    this.authClient = new AuthClient(this.transport);
    this.commandHandler = new CommandHandler(this.transport);
    this.fileTransferClient = new FileTransferClient(this.transport);
    this.localStore = new LocalStore();

    this.setupTransportHandlers();
  }

  setTui(tui: TuiManager): void {
    this.tui = tui;
  }

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

  private handleRegisterResponse(payload: Buffer): void {
    const response = JSON.parse(payload.toString()) as RegisterResponse;

    if (!response.success) {
      this.emit('error', new Error(response.error || '注册失败'));
    }
  }

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

  private handleChatPrivate(payload: Buffer): void {
    const message = JSON.parse(payload.toString()) as ChatPrivatePayload;
    this.emit('message', {
      type: 'private',
      sender: message.sender,
      content: message.text,
      timestamp: message.timestamp,
    });
  }

  private handleChatSystem(payload: Buffer): void {
    const message = JSON.parse(payload.toString()) as ChatSystemPayload;
    this.emit('message', {
      type: 'system',
      content: message.text,
      timestamp: message.timestamp,
    });
  }

  private handleUserList(payload: Buffer): void {
    const data = JSON.parse(payload.toString()) as UserListPayload;
    this.onlineUsers = data.users.map((nickname, index) => ({
      userId: index,
      nickname,
      socketId: '',
      activeRoom: data.room,
    }));
    this.tui?.updateUserList(this.onlineUsers);
  }

  private handleRoomList(payload: Buffer): void {
    const data = JSON.parse(payload.toString()) as RoomListPayload;
    this.tui?.updateRoomList(data.rooms);
  }

  private handleError(payload: Buffer): void {
    const error = JSON.parse(payload.toString()) as ErrorPayload;
    this.emit('error', new Error(error.message));
  }

  async connect(host: string, port: number): Promise<void> {
    this.state = ConnectionState.Connecting;

    try {
      await this.transport.connect(host, port);
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

  async login(nickname: string, password: string): Promise<void> {
    return await this.authClient.login(nickname, password);
  }

  async register(nickname: string, password: string): Promise<void> {
    return await this.authClient.register(nickname, password);
  }

  async sendRoomMessage(text: string): Promise<void> {
    return await this.commandHandler.sendRoomMessage(this.currentRoom, text);
  }

  async sendPrivateMessage(target: string, text: string): Promise<void> {
    return await this.commandHandler.sendPrivateMessage(target, text);
  }

  async joinRoom(roomName: string): Promise<void> {
    await this.commandHandler.joinRoom(roomName);
    this.currentRoom = roomName;
  }

  async leaveRoom(): Promise<void> {
    await this.commandHandler.leaveRoom(this.currentRoom);
  }

  async changeNickname(newNickname: string): Promise<void> {
    await this.commandHandler.changeNickname(newNickname);
  }

  async requestHistory(count: number = 50): Promise<void> {
    await this.commandHandler.requestHistory(this.currentRoom, count);
  }

  async sendFile(target: string, filePath: string): Promise<void> {
    await this.fileTransferClient.sendFile(target, filePath);
  }

  getState(): ConnectionState {
    return this.state;
  }

  getCurrentRoom(): string {
    return this.currentRoom;
  }

  getOnlineUsers(): OnlineUser[] {
    return this.onlineUsers;
  }

  async disconnect(): Promise<void> {
    this.transport.close();
    this.state = ConnectionState.Disconnected;
  }
}
