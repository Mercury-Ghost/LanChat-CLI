import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Transport } from './Transport';
import { MessageCodec } from '../shared/protocol/codec';
import { MessageType } from '../shared/protocol/types';
import {
  FileRequestPayload,
  FileResponsePayload,
  FileChunkPayload,
  FileEndPayload,
  FileProgressPayload,
} from '../shared/protocol/types';
import { LocalStore } from './LocalStore';
import { FileSplitter } from '../shared/protocol/file';
import { MAX_FILE_SIZE, CHUNK_SIZE } from '../shared/constants';
import * as uuid from 'uuid';

export interface FileTransferProgress {
  transferId: string;
  fileName: string;
  fileSize: number;
  receivedBytes: number;
  progress: number;
  status: 'sending' | 'receiving' | 'completed' | 'aborted';
}

export class FileTransferClient {
  private transport: Transport;
  private localStore: LocalStore;
  private pendingTransfers: Map<string, FileTransferProgress> = new Map();
  private receivedFiles: Map<string, string> = new Map();
  private onProgressCallback?: (progress: FileTransferProgress) => void;
  private onCompleteCallback?: (transferId: string, filePath: string) => void;
  private onErrorCallback?: (transferId: string, error: Error) => void;
  private downloadsDir: string;

  constructor(transport: Transport) {
    this.transport = transport;
    this.localStore = new LocalStore();
    this.downloadsDir = path.join(os.homedir(), 'Downloads');
  }

  onProgress(callback: (progress: FileTransferProgress) => void): void {
    this.onProgressCallback = callback;
  }

  onComplete(callback: (transferId: string, filePath: string) => void): void {
    this.onCompleteCallback = callback;
  }

  onError(callback: (transferId: string, error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  async sendFile(targetNickname: string, filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    if (fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      throw new Error(`文件大小必须在 1 字节到 ${MAX_FILE_SIZE} 字节之间`);
    }

    const fileName = path.basename(filePath);
    const transferId = uuid.v4();

    const progress: FileTransferProgress = {
      transferId,
      fileName,
      fileSize,
      receivedBytes: 0,
      progress: 0,
      status: 'sending',
    };

    this.pendingTransfers.set(transferId, progress);

    const payload: FileRequestPayload = {
      fileName,
      fileSize,
      targetUser: targetNickname,
      token: this.localStore.getToken(),
    };

    const buffer = MessageCodec.encodeJson(MessageType.FILE_REQUEST, payload);
    this.transport.send(buffer);

    this.readAndSendChunks(transferId, filePath);
  }

  private async readAndSendChunks(transferId: string, filePath: string): Promise<void> {
    const fileBuffer = fs.readFileSync(filePath);
    const chunks = FileSplitter.splitFile(fileBuffer, transferId);

    for (const chunk of chunks) {
      const chunkPayload = {
        transferId: chunk.transferId,
        chunkIndex: chunk.chunkIndex,
        data: chunk.data.toString('base64'),
      };

      const buffer = MessageCodec.encodeJson(MessageType.FILE_CHUNK, chunkPayload);
      this.transport.send(buffer);

      await this.delay(10);
    }

    const endPayload: FileEndPayload = {
      transferId,
      status: 'success',
    };

    const endBuffer = MessageCodec.encodeJson(MessageType.FILE_END, endPayload);
    this.transport.send(endBuffer);

    const progress = this.pendingTransfers.get(transferId);
    if (progress) {
      progress.status = 'completed';
      progress.progress = 100;
      this.onProgressCallback?.(progress);
    }
  }

  handleFileResponse(payload: Buffer): void {
    const response = JSON.parse(payload.toString()) as FileResponsePayload;

    if (!response.accepted) {
      const progress = this.pendingTransfers.get(response.transferId);
      if (progress) {
        progress.status = 'aborted';
        this.onErrorCallback?.(response.transferId, new Error(response.reason || '对方拒绝了文件传输'));
      }
    }
  }

  handleFileChunk(payload: Buffer): void {
    const chunk = JSON.parse(payload.toString()) as FileChunkPayload;
  }

  handleFileProgress(payload: Buffer): void {
    const progress = JSON.parse(payload.toString()) as FileProgressPayload;

    const transfer = this.pendingTransfers.get(progress.transferId);
    if (transfer) {
      transfer.receivedBytes = progress.receivedBytes;
      transfer.progress = Math.round((progress.receivedBytes / progress.totalBytes) * 100);
      this.onProgressCallback?.(transfer);
    }
  }

  handleFileEnd(payload: Buffer): void {
    const end = JSON.parse(payload.toString()) as FileEndPayload;

    const transfer = this.pendingTransfers.get(end.transferId);
    if (transfer) {
      if (end.status === 'success') {
        transfer.status = 'completed';
        transfer.progress = 100;

        const savedPath = this.getSavedFilePath(end.transferId, transfer.fileName);
        this.receivedFiles.set(end.transferId, savedPath);

        this.onCompleteCallback?.(end.transferId, savedPath);
      } else {
        transfer.status = 'aborted';
        this.onErrorCallback?.(end.transferId, new Error(end.reason || '传输失败'));
      }
      this.pendingTransfers.delete(end.transferId);
    }
  }

  private getSavedFilePath(transferId: string, fileName: string): string {
    let savePath = path.join(this.downloadsDir, fileName);
    let counter = 1;

    while (fs.existsSync(savePath)) {
      const ext = path.extname(fileName);
      const basename = path.basename(fileName, ext);
      savePath = path.join(this.downloadsDir, `${basename}_${counter}${ext}`);
      counter++;
    }

    return savePath;
  }

  acceptFile(transferId: string): void {
    const payload: FileResponsePayload = {
      transferId,
      accepted: true,
      nextChunkIndex: 0,
    };

    const buffer = MessageCodec.encodeJson(MessageType.FILE_RESPONSE, payload);
    this.transport.send(buffer);
  }

  rejectFile(transferId: string, reason?: string): void {
    const payload: FileResponsePayload = {
      transferId,
      accepted: false,
      reason,
    };

    const buffer = MessageCodec.encodeJson(MessageType.FILE_RESPONSE, payload);
    this.transport.send(buffer);
  }

  getTransfer(transferId: string): FileTransferProgress | undefined {
    return this.pendingTransfers.get(transferId);
  }

  getActiveTransfers(): FileTransferProgress[] {
    return Array.from(this.pendingTransfers.values());
  }

  cancelTransfer(transferId: string): void {
    const payload: FileEndPayload = {
      transferId,
      status: 'aborted',
      reason: '用户取消',
    };

    const buffer = MessageCodec.encodeJson(MessageType.FILE_END, payload);
    this.transport.send(buffer);

    this.pendingTransfers.delete(transferId);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
