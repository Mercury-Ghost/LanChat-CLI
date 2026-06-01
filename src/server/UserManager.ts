import { Logger } from 'winston';
import { OnlineUser } from '../shared/protocol/types';
import { DEFAULT_ROOM_NAME } from '../shared/constants';

export class UserManager {
  private users: Map<string, OnlineUser> = new Map();
  private userIdIndex: Map<number, OnlineUser> = new Map();
  private nicknameIndex: Map<string, string> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  addUser(socketId: string, userId: number, nickname: string): OnlineUser {
    const user: OnlineUser = {
      userId,
      nickname,
      socketId,
      activeRoom: DEFAULT_ROOM_NAME,
    };

    this.users.set(socketId, user);
    this.userIdIndex.set(userId, user);
    this.nicknameIndex.set(nickname, socketId);
    this.logger.info('用户上线', { socketId, nickname, userId });

    return user;
  }

  removeUser(socketId: string): OnlineUser | undefined {
    const user = this.users.get(socketId);
    if (user) {
      this.users.delete(socketId);
      this.userIdIndex.delete(user.userId);
      this.nicknameIndex.delete(user.nickname);
      this.logger.info('用户离线', { socketId, nickname: user.nickname });
    }
    return user;
  }

  getUser(socketId: string): OnlineUser | undefined {
    return this.users.get(socketId);
  }

  getUserByNickname(nickname: string): OnlineUser | undefined {
    const socketId = this.nicknameIndex.get(nickname);
    return socketId ? this.users.get(socketId) : undefined;
  }

  getUserByUserId(userId: number): OnlineUser | undefined {
    return this.userIdIndex.get(userId);
  }

  updateNickname(socketId: string, newNickname: string): boolean {
    const user = this.users.get(socketId);
    if (!user) {
      return false;
    }

    const existingSocketId = this.nicknameIndex.get(newNickname);
    if (existingSocketId && existingSocketId !== socketId) {
      return false;
    }

    const oldNickname = user.nickname;
    this.nicknameIndex.delete(oldNickname);
    user.nickname = newNickname;
    this.nicknameIndex.set(newNickname, socketId);
    this.logger.info('用户改名', { socketId, oldNickname, newNickname });

    return true;
  }

  updateActiveRoom(socketId: string, room: string): boolean {
    const user = this.users.get(socketId);
    if (!user) {
      return false;
    }

    user.activeRoom = room;
    return true;
  }

  getUsersInRoom(room: string): OnlineUser[] {
    const users: OnlineUser[] = [];
    for (const user of this.users.values()) {
      if (user.activeRoom === room) {
        users.push(user);
      }
    }
    return users;
  }

  getUsersInRoomSocketIds(room: string): string[] {
    return this.getUsersInRoom(room).map((user) => user.socketId);
  }

  isNicknameTaken(nickname: string, excludeSocketId?: string): boolean {
    const socketId = this.nicknameIndex.get(nickname);
    return socketId !== undefined && socketId !== excludeSocketId;
  }

  getOnlineUsers(): OnlineUser[] {
    // 返回用户对象的副本，避免外部直接修改内部数据
    return Array.from(this.users.values()).map((user) => ({ ...user }));
  }

  getOnlineUserCount(): number {
    return this.users.size;
  }

  getOnlineUserCountInRoom(room: string): number {
    return this.getUsersInRoom(room).length;
  }

  getAllSocketIds(): string[] {
    return Array.from(this.users.keys());
  }

  getSocketIdByNickname(nickname: string): string | undefined {
    return this.nicknameIndex.get(nickname);
  }
}
