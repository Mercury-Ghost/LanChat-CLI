import { Logger } from 'winston';
import * as uuid from 'uuid';
import { Database } from '../Database';
import { FileRepo } from '../repositories/FileRepo';
import { RoomRepo } from '../repositories/RoomRepo';
import { FileTransferHandler } from '../FileTransferHandler';
import { UserManager } from '../UserManager';
import {
  FileRequestPayload,
} from '../../shared/protocol/types';
import { MAX_FILE_SIZE, MAX_USER_TRANSFERS, MAX_GLOBAL_TRANSFERS } from '../../shared/constants';
import { ValidationError, NotFoundError, ResourceLimitError } from '../../shared/errors';

export interface FileTransferSession {
  transferId: string;
  fileName: string;
  fileSize: number;
  senderId: number;
  receiverId?: number;
  roomId?: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'aborted';
  startTime: number;
}

export class FileService {
  private database: Database;
  private fileRepo: FileRepo;
  private roomRepo: RoomRepo;
  private fileTransferHandler: FileTransferHandler;
  private userManager: UserManager;
  private logger: Logger;
  private sessions: Map<string, FileTransferSession> = new Map();

  constructor(
    database: Database,
    userManager: UserManager,
    logger: Logger
  ) {
    this.database = database;
    this.fileRepo = new FileRepo(database);
    this.roomRepo = new RoomRepo(database);
    this.fileTransferHandler = new FileTransferHandler(database, logger);
    this.userManager = userManager;
    this.logger = logger;
  }

  private validateTransferLimits(senderId: number): void {
    let activeSessionCount = 0;
    let userSessionCount = 0;

    for (const session of this.sessions.values()) {
      if (session.status === 'pending' || session.status === 'accepted') {
        activeSessionCount++;
        if (session.senderId === senderId) {
          userSessionCount++;
        }
      }
    }

    if (activeSessionCount >= MAX_GLOBAL_TRANSFERS) {
      throw new ResourceLimitError(`全局传输数已达上限: ${MAX_GLOBAL_TRANSFERS}`);
    }

    if (userSessionCount >= MAX_USER_TRANSFERS) {
      throw new ResourceLimitError(`用户并发传输数已达上限: ${MAX_USER_TRANSFERS}`);
    }
  }

  initiateTransfer(
    request: FileRequestPayload,
    senderId: number
  ): FileTransferSession {
    if (request.fileSize <= 0 || request.fileSize > MAX_FILE_SIZE) {
      throw new ValidationError(
        `文件大小必须在 1 字节到 ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB 之间`
      );
    }

    this.validateTransferLimits(senderId);

    const transferId = uuid.v4();

    const session: FileTransferSession = {
      transferId,
      fileName: request.fileName,
      fileSize: request.fileSize,
      senderId,
      status: 'pending',
      startTime: Date.now(),
    };

    if (request.targetUser) {
      const receiver = this.userManager.getUserByNickname(request.targetUser);
      if (!receiver) {
        throw new NotFoundError('目标用户');
      }
      session.receiverId = receiver.userId;
    }

    if (request.room) {
      const room = this.roomRepo.findByName(request.room);
      if (!room) {
        throw new NotFoundError('房间');
      }
      session.roomId = room.id;
    }

    this.sessions.set(transferId, session);

    this.fileTransferHandler.initiateTransfer(
      transferId,
      request.fileName,
      request.fileSize,
      senderId,
      session.receiverId,
      session.roomId
    );

    this.logger.info('文件传输会话创建', {
      transferId,
      fileName: request.fileName,
      fileSize: request.fileSize,
      senderId,
      receiverId: session.receiverId,
      roomId: session.roomId,
    });

    return session;
  }

  acceptTransfer(transferId: string, receiverId: number): void {
    const session = this.sessions.get(transferId);
    if (!session) {
      throw new ValidationError('传输会话不存在');
    }

    if (session.receiverId && session.receiverId !== receiverId) {
      throw new ValidationError('不是此传输的接收者');
    }

    session.status = 'accepted';
    this.logger.info('文件传输已接受', { transferId, receiverId });
  }

  rejectTransfer(transferId: string, receiverId: number, reason?: string): void {
    const session = this.sessions.get(transferId);
    if (!session) {
      throw new ValidationError('传输会话不存在');
    }

    if (session.receiverId && session.receiverId !== receiverId) {
      throw new ValidationError('不是此传输的接收者');
    }

    session.status = 'rejected';
    this.fileTransferHandler.abortTransfer(transferId);
    this.sessions.delete(transferId);

    this.logger.info('文件传输已拒绝', { transferId, receiverId, reason });
  }

  async receiveChunk(transferId: string, chunkIndex: number, data: Buffer): Promise<void> {
    await this.fileTransferHandler.receiveChunk(transferId, chunkIndex, data);

    const progress = this.fileTransferHandler.getProgress(transferId);
    this.logger.debug('文件块接收进度', { transferId, chunkIndex, progress });
  }

  async completeTransfer(transferId: string): Promise<string> {
    const session = this.sessions.get(transferId);
    if (!session) {
      throw new ValidationError('传输会话不存在');
    }

    session.status = 'completed';
    const storedPath = await this.fileTransferHandler.completeTransfer(transferId);

    this.fileRepo.updateStoredPath(transferId, storedPath!);
    this.sessions.delete(transferId);

    this.logger.info('文件传输完成', { transferId, storedPath });

    return storedPath!;
  }

  abortTransfer(transferId: string, reason?: string): void {
    const session = this.sessions.get(transferId);
    if (!session) {
      return;
    }

    session.status = 'aborted';
    this.fileTransferHandler.abortTransfer(transferId);
    this.sessions.delete(transferId);

    this.logger.info('文件传输中止', { transferId, reason });
  }

  getSession(transferId: string): FileTransferSession | undefined {
    return this.sessions.get(transferId);
  }

  getProgress(transferId: string): number {
    return this.fileTransferHandler.getProgress(transferId);
  }

  isTransferComplete(transferId: string): boolean {
    return this.fileTransferHandler.isTransferComplete(transferId);
  }
}
