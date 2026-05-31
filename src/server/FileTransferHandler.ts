import { Logger } from 'winston';
import * as fs from 'fs';
import * as path from 'path';
import { FILES_DIR, CHUNK_SIZE, MAX_FILE_SIZE, TEMP_FILE_RETENTION_HOURS } from '../shared/constants';
import { FileRepo } from './repositories/FileRepo';
import { Database } from './Database';
import { FileMetadata, FileSplitter } from '../shared/protocol/file';
import { FileRequestPayload, FileChunkPayload } from '../shared/protocol/types';
import { ValidationError } from '../shared/errors';

export class FileTransferHandler {
  private activeTransfers: Map<string, FileMetadata & { senderId: number; receiverId?: number | null; roomId?: number | null }> = new Map();
  private tempFiles: Map<string, { writeStream: fs.WriteStream }> = new Map();
  private database: Database;
  private fileRepo: FileRepo;
  private logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.database = database;
    this.fileRepo = new FileRepo(database);
    this.logger = logger;

    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    const filesDir = path.resolve(FILES_DIR);
    const tempDir = path.join(filesDir, 'temp');

    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir, { recursive: true });
    }

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  }

  initiateTransfer(
    transferId: string,
    fileName: string,
    fileSize: number,
    senderId: number,
    receiverId?: number | null,
    roomId?: number | null
  ): FileMetadata & { senderId: number; receiverId?: number | null; roomId?: number | null } {
    if (fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      throw new ValidationError(`文件大小必须在 1 字节到 ${MAX_FILE_SIZE} 字节之间`);
    }

    const totalChunks = FileSplitter.calculateTotalChunks(fileSize);

    const metadata: FileMetadata & { senderId: number; receiverId?: number | null; roomId?: number | null } = {
      transferId,
      fileName,
      fileSize,
      totalChunks,
      receivedChunks: new Set(),
      senderId,
      receiverId,
      roomId,
    };

    this.activeTransfers.set(transferId, metadata);

    const tempFilePath = path.join(FILES_DIR, 'temp', `${transferId}.tmp`);
    const writeStream = fs.createWriteStream(tempFilePath);

    this.tempFiles.set(transferId, {
      writeStream,
    });

    this.logger.info('文件传输开始', { transferId, fileName, fileSize, senderId, receiverId, roomId });

    return metadata;
  }

  receiveChunk(transferId: string, chunkIndex: number, data: Buffer): void {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) {
      throw new Error(`Transfer ${transferId} not found`);
    }

    const tempFile = this.tempFiles.get(transferId);
    if (!tempFile) {
      throw new Error(`Temp file for transfer ${transferId} not found`);
    }

    transfer.receivedChunks.add(chunkIndex);
    tempFile.writeStream.write(data);

    this.logger.debug('接收文件块', { transferId, chunkIndex });
  }

  getProgress(transferId: string): number {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) {
      return 0;
    }

    return FileSplitter.getProgress(transfer.receivedChunks, transfer.totalChunks);
  }

  completeTransfer(transferId: string): string | null {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) {
      return null;
    }

    const tempFile = this.tempFiles.get(transferId);
    if (!tempFile) {
      return null;
    }

    const tempFilePath = path.join(FILES_DIR, 'temp', `${transferId}.tmp`);
    const finalFilePath = path.join(FILES_DIR, `${transferId}_${transfer.fileName}`);

    tempFile.writeStream.end(() => {
      if (fs.existsSync(tempFilePath)) {
        fs.renameSync(tempFilePath, finalFilePath);
      }
    });

    this.fileRepo.create({
      transferId,
      senderId: transfer.senderId,
      receiverId: transfer.receiverId,
      roomId: transfer.roomId,
      fileName: transfer.fileName,
      fileSize: transfer.fileSize,
      storedPath: finalFilePath,
    });

    this.cleanupTransfer(transferId);

    this.logger.info('文件传输完成', { transferId, fileName: transfer.fileName });

    return finalFilePath;
  }

  abortTransfer(transferId: string): void {
    const transfer = this.activeTransfers.get(transferId);
    if (transfer) {
      const tempFilePath = path.join(FILES_DIR, 'temp', `${transferId}.tmp`);
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }

    this.cleanupTransfer(transferId);

    this.logger.info('文件传输中止', { transferId });
  }

  private cleanupTransfer(transferId: string): void {
    this.activeTransfers.delete(transferId);

    const tempFile = this.tempFiles.get(transferId);
    if (tempFile) {
      tempFile.writeStream.destroy();
      this.tempFiles.delete(transferId);
    }
  }

  getTransfer(transferId: string): FileMetadata | undefined {
    return this.activeTransfers.get(transferId);
  }

  isTransferComplete(transferId: string): boolean {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) {
      return false;
    }

    return transfer.receivedChunks.size === transfer.totalChunks;
  }

  cleanupOldTempFiles(): void {
    const tempDir = path.join(FILES_DIR, 'temp');
    const maxAge = TEMP_FILE_RETENTION_HOURS * 60 * 60 * 1000;
    const now = Date.now();

    if (!fs.existsSync(tempDir)) {
      return;
    }

    const files = fs.readdirSync(tempDir);

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        this.logger.info('删除过期临时文件', { file });
      }
    }
  }
}
