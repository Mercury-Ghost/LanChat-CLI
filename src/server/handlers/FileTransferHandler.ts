import { Logger } from 'winston';
import { UserManager } from '../UserManager';
import { RoomManager } from '../RoomManager';
import { ClientConnection } from '../ClientConnection';
import { TlsServer } from '../TlsServer';
import { MessageType } from '../../shared/protocol/types';
import {
  FileRequestPayload,
  FileResponsePayload,
  FileChunkPayload,
  FileEndPayload,
  FileProgressPayload,
  AuthenticatedUser,
} from '../../shared/protocol/types';
import { MessageCodec } from '../../shared/protocol/codec';
import { CHUNK_SIZE } from '../../shared/constants';
import { ValidationError, AppError, ErrorCode } from '../../shared/errors';
import { FileService } from '../services/FileService';

export class FileTransferHandler {
  private userManager: UserManager;
  private roomManager: RoomManager;
  private connection: ClientConnection;
  private server: TlsServer;
  private fileService: FileService;
  private logger: Logger;

  constructor(
    connection: ClientConnection,
    userManager: UserManager,
    roomManager: RoomManager,
    server: TlsServer,
    fileService: FileService,
    logger: Logger
  ) {
    this.connection = connection;
    this.userManager = userManager;
    this.roomManager = roomManager;
    this.server = server;
    this.fileService = fileService;
    this.logger = logger;
  }

  handleFileRequest(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    try {
      const { payload: data } = MessageCodec.decodeJson<FileRequestPayload & { token: string }>(payload);
      const request = data as FileRequestPayload;

      if (!request.targetUser && !request.room) {
        throw new ValidationError('必须指定目标用户或房间');
      }

      const session = this.fileService.initiateTransfer(request, user.userId);

      const forwardPayload: FileRequestPayload & { transferId: string; sender: string } = {
        ...request,
        transferId: session.transferId,
        sender: user.nickname,
      };

      if (request.targetUser) {
        const targetUser = this.userManager.getUserByNickname(request.targetUser);
        if (!targetUser) {
          throw new AppError(ErrorCode.USER_NOT_FOUND, '目标用户不在线');
        }
        const targetConnection = this.server.getConnection(targetUser.socketId);
        if (targetConnection) {
          targetConnection.sendMessage(MessageType.FILE_REQUEST, forwardPayload);
        }
        this.logger.info('文件请求已转发给用户', {
          socketId,
          transferId: session.transferId,
          sender: user.nickname,
          target: request.targetUser,
        });
      } else if (request.room) {
        this.server.broadcastToRoom(
          request.room,
          MessageCodec.encodeJson(MessageType.FILE_REQUEST, forwardPayload),
          [socketId]
        );
        this.logger.info('文件请求已广播到房间', {
          socketId,
          transferId: session.transferId,
          sender: user.nickname,
          room: request.room,
        });
      }
    } catch (error) {
      this.logger.error('处理文件请求失败', { socketId, error });
      throw error;
    }
  }

  handleFileResponse(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    try {
      const { payload: data } = MessageCodec.decodeJson<FileResponsePayload>(payload);
      const response = data as FileResponsePayload;

      const session = this.fileService.getSession(response.transferId);
      if (!session) {
        throw new ValidationError('传输会话不存在');
      }

      if (response.accepted) {
        this.fileService.acceptTransfer(response.transferId, user.userId);

        const forwardPayload: FileResponsePayload & { acceptor: string } = {
          ...response,
          acceptor: user.nickname,
        };

        const senderUser = this.userManager.getUserByUserId(session.senderId);

        if (senderUser) {
          const senderConnection = this.server.getConnection(senderUser.socketId);
          if (senderConnection) {
            senderConnection.sendMessage(MessageType.FILE_RESPONSE, forwardPayload);
          }
        }

        this.logger.info('文件传输已接受', {
          socketId,
          transferId: response.transferId,
          acceptor: user.nickname,
        });
      } else {
        this.fileService.rejectTransfer(response.transferId, user.userId, response.reason);

        const forwardPayload: FileResponsePayload & { rejector: string } = {
          ...response,
          rejector: user.nickname,
        };

        const senderUser = this.userManager.getUserByUserId(session.senderId);

        if (senderUser) {
          const senderConnection = this.server.getConnection(senderUser.socketId);
          if (senderConnection) {
            senderConnection.sendMessage(MessageType.FILE_RESPONSE, forwardPayload);
          }
        }

        this.logger.info('文件传输已拒绝', {
          socketId,
          transferId: response.transferId,
          rejector: user.nickname,
          reason: response.reason,
        });
      }
    } catch (error) {
      this.logger.error('处理文件响应失败', { socketId, error });
      throw error;
    }
  }

  async handleFileChunk(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): Promise<void> {
    try {
      const { payload: data } = MessageCodec.decodeJson<FileChunkPayload>(payload);
      const chunkPayload = data as FileChunkPayload;

      const session = this.fileService.getSession(chunkPayload.transferId);
      if (!session) {
        throw new ValidationError('传输会话不存在');
      }

      const chunkData = Buffer.from(chunkPayload.data, 'base64');
      await this.fileService.receiveChunk(
        chunkPayload.transferId,
        chunkPayload.chunkIndex,
        chunkData
      );

      const progress = this.fileService.getProgress(chunkPayload.transferId);
      const progressPayload: FileProgressPayload = {
        transferId: chunkPayload.transferId,
        receivedBytes: (chunkPayload.chunkIndex + 1) * CHUNK_SIZE,
        totalBytes: session.fileSize,
      };

      const senderUser = this.userManager.getUserByUserId(session.senderId);
      if (senderUser) {
        const senderConnection = this.server.getConnection(senderUser.socketId);
        if (senderConnection) {
          senderConnection.sendMessage(MessageType.FILE_PROGRESS, progressPayload);
        }
      }

      this.logger.debug('接收文件块', {
        socketId,
        transferId: chunkPayload.transferId,
        chunkIndex: chunkPayload.chunkIndex,
        progress,
      });
    } catch (error) {
      this.logger.error('处理文件块失败', { socketId, error });
      throw error;
    }
  }

  async handleFileEnd(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): Promise<void> {
    try {
      const { payload: data } = MessageCodec.decodeJson<FileEndPayload>(payload);
      const endPayload = data as FileEndPayload;

      const session = this.fileService.getSession(endPayload.transferId);
      if (!session) {
        throw new ValidationError('传输会话不存在');
      }

      if (endPayload.status === 'success') {
        const storedPath = await this.fileService.completeTransfer(endPayload.transferId);

        const forwardPayload: FileEndPayload & { storedPath?: string } = {
          ...endPayload,
          storedPath,
        };

        if (session.receiverId) {
          const receiverUser = this.userManager.getUserByUserId(session.receiverId);
          if (receiverUser) {
            const receiverConnection = this.server.getConnection(receiverUser.socketId);
            if (receiverConnection) {
              receiverConnection.sendMessage(MessageType.FILE_END, forwardPayload);
            }
          }
        } else if (session.roomId) {
          const room = this.roomManager.getAllRooms().find((r) => r.id === session.roomId);
          if (room) {
            this.server.broadcastToRoom(
              room.name,
              MessageCodec.encodeJson(MessageType.FILE_END, forwardPayload)
            );
          }
        }

        this.logger.info('文件传输完成', {
          socketId,
          transferId: endPayload.transferId,
          storedPath,
        });
      } else {
        this.fileService.abortTransfer(endPayload.transferId, endPayload.reason);

        const forwardPayload: FileEndPayload = {
          ...endPayload,
        };

        if (session.receiverId) {
          const receiverUser = this.userManager.getUserByUserId(session.receiverId);
          if (receiverUser) {
            const receiverConnection = this.server.getConnection(receiverUser.socketId);
            if (receiverConnection) {
              receiverConnection.sendMessage(MessageType.FILE_END, forwardPayload);
            }
          }
        } else if (session.roomId) {
          const room = this.roomManager.getAllRooms().find((r) => r.id === session.roomId);
          if (room) {
            this.server.broadcastToRoom(
              room.name,
              MessageCodec.encodeJson(MessageType.FILE_END, forwardPayload)
            );
          }
        }

        this.logger.info('文件传输中止', {
          socketId,
          transferId: endPayload.transferId,
          reason: endPayload.reason,
        });
      }
    } catch (error) {
      this.logger.error('处理文件结束失败', { socketId, error });
      throw error;
    }
  }

  handleFileProgress(
    socketId: string,
    user: AuthenticatedUser,
    payload: Buffer
  ): void {
    try {
      const { payload: data } = MessageCodec.decodeJson<FileProgressPayload>(payload);
      const progressPayload = data as FileProgressPayload;

      const session = this.fileService.getSession(progressPayload.transferId);
      if (!session) {
        throw new ValidationError('传输会话不存在');
      }

      if (session.receiverId) {
        const receiverUser = this.userManager.getUserByUserId(session.receiverId);
        if (receiverUser) {
          const receiverConnection = this.server.getConnection(receiverUser.socketId);
          if (receiverConnection) {
            receiverConnection.sendMessage(MessageType.FILE_PROGRESS, progressPayload);
          }
        }
      } else if (session.roomId) {
        const room = this.roomManager.getAllRooms().find((r) => r.id === session.roomId);
        if (room) {
          this.server.broadcastToRoom(
            room.name,
            MessageCodec.encodeJson(MessageType.FILE_PROGRESS, progressPayload)
          );
        }
      }
    } catch (error) {
      this.logger.error('处理文件进度失败', { socketId, error });
    }
  }
}
