import { Logger } from 'winston';
import { OnlineUser } from '../shared/protocol/types';
import { DEFAULT_ROOM_NAME } from '../shared/constants';

export class UserManager {
  private users: Map<string, OnlineUser> = new Map();
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
    this.logger.info('用户上线', { socketId, nickname, userId });

    return user;
  }

  removeUser(socketId: string): OnlineUser | undefined {
    const user = this.users.get(socketId);
    if (user) {
      this.users.delete(socketId);
      this.logger.info('用户离线', { socketId, nickname: user.nickname });
    }
    return user;
  }

  getUser(socketId: string): OnlineUser | undefined {
    return this.users.get(socketId);
  }

  getUserByNickname(nickname: string): OnlineUser | undefined {
    for (const user of this.users.values()) {
      if (user.nickname === nickname) {
        return user;
      }
    }
    return undefined;
  }

  updateNickname(socketId: string, newNickname: string): boolean {
    const user = this.users.get(socketId);
    if (!user) {
      return false;
    }

    const existingUser = this.getUserByNickname(newNickname);
    if (existingUser && existingUser.socketId !== socketId) {
      return false;
    }

    const oldNickname = user.nickname;
    user.nickname = newNickname;
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
    for (const user of this.users.values()) {
      if (user.nickname === nickname && user.socketId !== excludeSocketId) {
        return true;
      }
    }
    return false;
  }

  getOnlineUsers(): OnlineUser[] {
    return Array.from(this.users.values());
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
    const user = this.getUserByNickname(nickname);
    return user?.socketId;
  }
}
