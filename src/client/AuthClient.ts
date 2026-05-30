import { Transport } from './Transport';
import { MessageCodec } from '../shared/protocol/codec';
import { MessageType } from '../shared/protocol/types';
import { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, ChangePasswordRequest } from '../shared/protocol/types';
import { LocalStore } from './LocalStore';

export class AuthClient {
  private transport: Transport;
  private localStore: LocalStore;

  constructor(transport: Transport) {
    this.transport = transport;
    this.localStore = new LocalStore();
  }

  async login(nickname: string, password: string): Promise<void> {
    const request: LoginRequest = {
      nickname,
      password,
    };

    const buffer = MessageCodec.encodeJson(MessageType.LOGIN_REQUEST, request);
    this.transport.send(buffer);
  }

  async register(nickname: string, password: string): Promise<void> {
    const request: RegisterRequest = {
      nickname,
      password,
    };

    const buffer = MessageCodec.encodeJson(MessageType.REGISTER_REQUEST, request);
    this.transport.send(buffer);
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const request: ChangePasswordRequest = {
      oldPassword,
      newPassword,
      token: this.localStore.getToken() || '',
    };

    const buffer = MessageCodec.encodeJson(MessageType.CHANGE_PASSWORD, request);
    this.transport.send(buffer);
  }
}
