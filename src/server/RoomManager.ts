import { Logger } from 'winston';
import { RoomRepo } from './repositories/RoomRepo';
import { Database } from './Database';
import { NotFoundError, ValidationError, AppError, ErrorCode } from '../shared/errors';
import { DEFAULT_ROOM_NAME } from '../shared/constants';
import { RoomInfo } from '../shared/protocol/types';
import { validateRoomName } from '../shared/validators';

export class RoomManager {
  private rooms: Map<string, Set<number>> = new Map();
  private database: Database;
  private roomRepo: RoomRepo;
  private logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.database = database;
    this.roomRepo = new RoomRepo(database);
    this.logger = logger;

    this.initializeDefaultRoom();
  }

  private initializeDefaultRoom(): void {
    if (!this.rooms.has(DEFAULT_ROOM_NAME)) {
      this.rooms.set(DEFAULT_ROOM_NAME, new Set());
    }

    let defaultRoom = this.roomRepo.findByName(DEFAULT_ROOM_NAME);
    if (!defaultRoom) {
      this.roomRepo.create(DEFAULT_ROOM_NAME, null);
    }
  }

  createRoom(name: string, createdBy: number): void {
    const validation = validateRoomName(name);
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
    }

    if (this.rooms.has(name)) {
      throw new AppError(ErrorCode.ALREADY_IN_ROOM, '房间已存在');
    }

    this.rooms.set(name, new Set());
    const userId = this.roomRepo.create(name, createdBy);

    this.logger.info('房间创建', { name, createdBy: userId });
  }

  joinRoom(name: string, userId: number): void {
    const room = this.rooms.get(name);
    if (!room) {
      throw new NotFoundError('房间');
    }

    room.add(userId);
    this.logger.info('用户加入房间', { name, userId });
  }

  leaveRoom(name: string, userId: number): void {
    if (name === DEFAULT_ROOM_NAME) {
      throw new ValidationError('不能离开默认房间');
    }

    const room = this.rooms.get(name);
    if (room) {
      room.delete(userId);

      if (room.size === 0) {
        this.rooms.delete(name);
        this.roomRepo.delete(name);
        this.logger.info('房间已删除（无成员）', { name });
      }
    }
  }

  isUserInRoom(name: string, userId: number): boolean {
    const room = this.rooms.get(name);
    return room ? room.has(userId) : false;
  }

  getRoomMembers(name: string): Set<number> {
    return this.rooms.get(name) || new Set();
  }

  getRoomMemberCount(name: string): number {
    return this.rooms.get(name)?.size || 0;
  }

  getAllRooms(): RoomInfo[] {
    const rooms: RoomInfo[] = [];

    for (const [name] of this.rooms) {
      const roomInfo = this.roomRepo.findByName(name);
      if (roomInfo) {
        rooms.push({
          id: roomInfo.id,
          name: roomInfo.name,
          memberCount: this.getRoomMemberCount(name),
        });
      }
    }

    return rooms;
  }

  getRoomName(id: number): string | undefined {
    const room = this.roomRepo.findById(id);
    return room?.name;
  }

  getRoomId(name: string): number | undefined {
    const room = this.roomRepo.findByName(name);
    return room?.id;
  }

  getDefaultRoom(): string {
    return DEFAULT_ROOM_NAME;
  }

  roomExists(name: string): boolean {
    return this.rooms.has(name);
  }
}
