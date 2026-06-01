import { Logger } from 'winston';
import * as fs from 'fs';
import * as path from 'path';
import { FILES_DIR, MAX_FILE_SIZE, TEMP_FILE_RETENTION_HOURS, MAX_GLOBAL_TRANSFERS, MAX_USER_TRANSFERS } from '../shared/constants';
import { FileRepo } from './repositories/FileRepo';
import { Database } from './Database';
import { FileMetadata, FileSplitter } from '../shared/protocol/file';

import { ValidationError, ResourceLimitError } from '../shared/errors';

interface TempFile {
  writeStream: fs.WriteStream;
  drainPromise: Promise<void> | null;
  error: Error | null;
}

export class FileTransferHandler {
  private activeTransfers: Map<string, FileMetadata & { senderId: number; receiverId?: number | null; roomId?: number | null }> = new Map();
  private tempFiles: Map<string, TempFile> = new Map();
  private database: Database;
  private fileRepo: FileRepo;
  private logger: Logger;
  private readonly MAX_FILENAME_LENGTH = 255;

  private validateAndSanitizeFileName(fileName: string): string {
    if (!fileName || fileName.trim().length === 0) {
      throw new ValidationError('文件名不能为空');
    }

    let sanitizedFileName = fileName;

    sanitizedFileName = sanitizedFileName.replace(/[/\\]/g, '_');
    sanitizedFileName = sanitizedFileName.replace(/\.\./g, '_');
    sanitizedFileName = sanitizedFileName.replace(/[<>:"|?*]/g, '_');

    sanitizedFileName = sanitizedFileName.trim();

    if (sanitizedFileName.length === 0) {
      throw new ValidationError('文件名无效');
    }

    if (sanitizedFileName.length > this.MAX_FILENAME_LENGTH) {
      sanitizedFileName = sanitizedFileName.substring(0, this.MAX_FILENAME_LENGTH);
    }

    return sanitizedFileName;
  }

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

  private validateTransferLimits(senderId: number): void {
    if (this.activeTransfers.size >= MAX_GLOBAL_TRANSFERS) {
      throw new ResourceLimitError(`全局传输数已达上限: ${MAX_GLOBAL_TRANSFERS}`);
    }

    let userTransferCount = 0;
    for (const transfer of this.activeTransfers.values()) {
      if (transfer.senderId === senderId) {
        userTransferCount++;
      }
    }

    if (userTransferCount >= MAX_USER_TRANSFERS) {
      throw new ResourceLimitError(`用户并发传输数已达上限: ${MAX_USER_TRANSFERS}`);
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

    this.validateTransferLimits(senderId);

    const sanitizedFileName = this.validateAndSanitizeFileName(fileName);
    const totalChunks = FileSplitter.calculateTotalChunks(fileSize);

    const metadata: FileMetadata & { senderId: number; receiverId?: number | null; roomId?: number | null } = {
      transferId,
      fileName: sanitizedFileName,
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

    const tempFile: TempFile = {
      writeStream,
      drainPromise: null,
      error: null,
    };

    writeStream.on('error', (err) => {
      tempFile.error = err;
      this.logger.error('写入流错误', { transferId, error: err.message });
    });

    this.tempFiles.set(transferId, tempFile);

    this.logger.info('文件传输开始', { transferId, fileName, fileSize, senderId, receiverId, roomId });

    return metadata;
  }

  async receiveChunk(transferId: string, chunkIndex: number, data: Buffer): Promise<void> {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) {
      throw new Error(`Transfer ${transferId} not found`);
    }

    const tempFile = this.tempFiles.get(transferId);
    if (!tempFile) {
      throw new Error(`Temp file for transfer ${transferId} not found`);
    }

    if (tempFile.error) {
      throw new Error(`Write stream error: ${tempFile.error.message}`);
    }

    if (tempFile.drainPromise) {
      await tempFile.drainPromise;
    }

    transfer.receivedChunks.add(chunkIndex);

    const canWrite = tempFile.writeStream.write(data);

    if (!canWrite) {
      tempFile.drainPromise = new Promise<void>((resolve, reject) => {
        const onDrain = () => {
          tempFile.writeStream.off('error', onError);
          tempFile.drainPromise = null;
          resolve();
        };

        const onError = (err: Error) => {
          tempFile.writeStream.off('drain', onDrain);
          tempFile.error = err;
          tempFile.drainPromise = null;
          reject(err);
        };

        tempFile.writeStream.once('drain', onDrain);
        tempFile.writeStream.once('error', onError);
      });
    }

    this.logger.debug('接收文件块', { transferId, chunkIndex });
  }

  getProgress(transferId: string): number {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) {
      return 0;
    }

    return FileSplitter.getProgress(transfer.receivedChunks, transfer.totalChunks);
  }

  async completeTransfer(transferId: string): Promise<string | null> {
    const transfer = this.activeTransfers.get(transferId);
    if (!transfer) {
      return null;
    }

    const tempFile = this.tempFiles.get(transferId);
    if (!tempFile) {
      return null;
    }

    if (tempFile.drainPromise) {
      await tempFile.drainPromise;
    }

    if (tempFile.error) {
      throw new Error(`Write stream error: ${tempFile.error.message}`);
    }

    const tempFilePath = path.join(FILES_DIR, 'temp', `${transferId}.tmp`);
    const finalFilePath = path.join(FILES_DIR, `${transferId}_${transfer.fileName}`);

    await new Promise<void>((resolve, reject) => {
      tempFile.writeStream.on('error', reject);
      tempFile.writeStream.end(() => {
        if (fs.existsSync(tempFilePath)) {
          try {
            fs.renameSync(tempFilePath, finalFilePath);
            resolve();
          } catch (err) {
            reject(err);
          }
        } else {
          resolve();
        }
      });
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
