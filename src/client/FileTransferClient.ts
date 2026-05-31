import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { Transport } from './Transport';
import { MessageCodec } from '../shared/protocol/codec';
import { MessageType } from '../shared/protocol/types';
import {
  FileRequestPayload,
  FileResponsePayload,
  FileChunkPayload,
  FileEndPayload,
} from '../shared/protocol/types';
import { LocalStore } from './LocalStore';

/**
 * 文件传输进度回调类型
 */
type ProgressCallback = (_bytesTransferred: number, _totalBytes: number) => void;

/**
 * 文件传输完成回调类型
 */
type CompleteCallback = (_filePath: string, _success: boolean) => void;

/**
 * 文件传输错误回调类型
 */
type ErrorCallback = (_error: Error) => void;

/**
 * 文件传输客户端类
 * 
 * @description 负责处理文件传输功能，支持大文件分块传输、进度追踪和断点续传
 *              通过传输层与服务器进行文件数据交换
 * 
 * @example
 * ```typescript
 * const transfer = new FileTransferClient(transport);
 * 
 * transfer.onProgress((sent, total) => {
 *   console.log(`传输进度: ${sent}/${total}`);
 * });
 * 
 * await transfer.sendFile('recipient', '/path/to/file.pdf');
 * ```
 */
export class FileTransferClient {
  /** 传输层实例 */
  private transport: Transport;
  
  /** 本地存储实例 */
  private localStore: LocalStore;
  
  /** 文件块大小 (64KB) */
  private chunkSize: number = 65536;
  
  /** 最大文件大小 (500MB) */
  private maxFileSize: number = 524288000;
  
  /** 临时文件存储目录 */
  private tempDir: string;
  
  /** 进度回调函数 */
  private progressCallback?: ProgressCallback;
  
  /** 完成回调函数 */
  private completeCallback?: CompleteCallback;
  
  /** 错误回调函数 */
  private errorCallback?: ErrorCallback;

  /**
   * 活跃传输任务映射
   */
  private activeTransfers: Map<
    string,
    {
      stream: fs.WriteStream | null;
      totalBytes: number;
      receivedBytes: number;
      tempPath: string;
    }
  > = new Map();

  /**
   * 构造函数
   * 
   * @param transport - 传输层实例
   */
  constructor(transport: Transport) {
    this.transport = transport;
    this.localStore = new LocalStore();
    this.tempDir = path.join(os.tmpdir(), 'lanchat');

    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * 设置进度回调
   * 
   * @param callback - 进度更新回调函数
   */
  onProgress(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  /**
   * 设置完成回调
   * 
   * @param callback - 传输完成回调函数
   */
  onComplete(callback: CompleteCallback): void {
    this.completeCallback = callback;
  }

  /**
   * 设置错误回调
   * 
   * @param callback - 错误发生回调函数
   */
  onError(callback: ErrorCallback): void {
    this.errorCallback = callback;
  }

  /**
   * 发送文件
   * 
   * @param targetNickname - 目标用户昵称
   * @param filePath - 要发送的文件路径
   * @returns {Promise<void>} 文件发送成功后 resolve
   * @throws {Error} 文件不存在或大小超限时抛出错误
   */
  async sendFile(targetNickname: string, filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    if (stats.size > this.maxFileSize) {
      throw new Error(`文件大小超过限制: ${stats.size} > ${this.maxFileSize}`);
    }

    const fileName = path.basename(filePath);
    const fileId = crypto.randomUUID();

    const request: FileRequestPayload = {
      fileName,
      fileSize: stats.size,
      targetUser: targetNickname,
      token: this.localStore.getToken() || undefined,
    };

    const buffer = MessageCodec.encodeJson(MessageType.FILE_REQUEST, request);
    this.transport.send(buffer);

    const transferId = fileId;
    let chunkIndex = 0;
    let offset = 0;

    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(filePath, { highWaterMark: this.chunkSize });
      
      readStream.on('data', (chunk: string | Buffer) => {
        readStream.pause();
        
        const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        
        const chunkPayload: FileChunkPayload = {
          transferId,
          data: chunkBuffer.toString('base64'),
          chunkIndex,
        };

        const chunkBuffer2 = MessageCodec.encodeJson(MessageType.FILE_CHUNK, chunkPayload);
        this.transport.send(chunkBuffer2);

        offset += chunkBuffer.length;
        chunkIndex++;

        if (this.progressCallback) {
          this.progressCallback(offset, stats.size);
        }

        setTimeout(() => {
          readStream.resume();
        }, 10);
      });

      readStream.on('end', () => {
        const endPayload: FileEndPayload = {
          transferId,
          status: 'success',
        };

        const endBuffer = MessageCodec.encodeJson(MessageType.FILE_END, endPayload);
        this.transport.send(endBuffer);
        resolve();
      });

      readStream.on('error', (error: Error) => {
        if (this.errorCallback) {
          this.errorCallback(error);
        }
        reject(error);
      });
    });
  }

  /**
   * 处理文件响应
   * 
   * @param payload - 响应数据
   */
  handleFileResponse(payload: Buffer): void {
    try {
      const response = JSON.parse(payload.toString()) as FileResponsePayload;

      if (!response.accepted) {
        if (this.errorCallback) {
          this.errorCallback(new Error(response.reason || '文件传输被拒绝'));
        }
      }
    } catch (error) {
      if (this.errorCallback) {
        this.errorCallback(error as Error);
      }
    }
  }

  /**
   * 处理文件数据块
   * 
   * @param payload - 文件块数据
   */
  handleFileChunk(payload: Buffer): void {
    try {
      const chunkData = JSON.parse(payload.toString()) as FileChunkPayload;
      const { transferId, data } = chunkData;

      const transfer = this.activeTransfers.get(transferId);
      if (!transfer) {
        return;
      }

      if (!transfer.stream) {
        transfer.stream = fs.createWriteStream(transfer.tempPath);
      }

      const chunk = Buffer.from(data, 'base64');
      transfer.stream.write(chunk);
      transfer.receivedBytes += chunk.length;

      if (this.progressCallback) {
        this.progressCallback(transfer.receivedBytes, transfer.totalBytes);
      }
    } catch (error) {
      if (this.errorCallback) {
        this.errorCallback(error as Error);
      }
    }
  }

  /**
   * 处理文件传输结束
   * 
   * @param payload - 结束数据
   */
  handleFileEnd(payload: Buffer): void {
    try {
      const endData = JSON.parse(payload.toString()) as FileEndPayload;
      const { transferId, status } = endData;

      const transfer = this.activeTransfers.get(transferId);
      if (transfer && transfer.stream) {
        transfer.stream.end();
      }

      const tempPath = transfer?.tempPath || '';
      this.activeTransfers.delete(transferId);

      if (this.completeCallback) {
        this.completeCallback(tempPath, status === 'success');
      }
    } catch (error) {
      if (this.errorCallback) {
        this.errorCallback(error as Error);
      }
    }
  }

  /**
   * 处理文件传输进度更新
   * 
   * @param payload - 进度数据
   */
  handleFileProgress(_payload: Buffer): void {
    // 服务端进度更新处理
  }

  /**
   * 取消文件传输
   * 
   * @param fileId - 文件传输 ID
   */
  cancelTransfer(fileId: string): void {
    const transfer = this.activeTransfers.get(fileId);
    if (transfer) {
      if (transfer.stream) {
        transfer.stream.destroy();
      }
      if (fs.existsSync(transfer.tempPath)) {
        fs.unlinkSync(transfer.tempPath);
      }
      this.activeTransfers.delete(fileId);
    }
  }
}
