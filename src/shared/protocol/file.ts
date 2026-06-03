import { CHUNK_SIZE } from '../constants';

export interface FileChunk {
    transferId: string;
    chunkIndex: number;
    data: Buffer;
    isLast: boolean;
}

export interface FileMetadata {
    transferId: string;
    fileName: string;
    fileSize: number;
    totalChunks: number;
    receivedChunks: Set<number>;
}

export class FileSplitter {
  static splitFile(buffer: Buffer, transferId: string): FileChunk[] {
    const chunks: FileChunk[] = [];
    const totalChunks = Math.ceil(buffer.length / CHUNK_SIZE);
    let chunkIndex = 0;

    for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
      const isLast = chunkIndex === totalChunks - 1;
      const data = buffer.subarray(offset, Math.min(offset + CHUNK_SIZE, buffer.length));

      chunks.push({
        transferId,
        chunkIndex,
        data,
        isLast,
      });

      chunkIndex++;
    }

    return chunks;
  }

  static assembleChunks(
    chunks: Map<number, Buffer>,
    totalChunks: number
  ): Buffer | null {
    if (chunks.size !== totalChunks) {
      return null;
    }

    const buffers: Buffer[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunk = chunks.get(i);
      if (!chunk) {
        return null;
      }
      buffers.push(chunk);
    }

    return Buffer.concat(buffers);
  }

  static calculateTotalChunks(fileSize: number): number {
    return Math.ceil(fileSize / CHUNK_SIZE);
  }

  static getChunkRange(
    startChunk: number,
    totalChunks: number
  ): number[] {
    const chunks: number[] = [];
    for (let i = startChunk; i < totalChunks; i++) {
      chunks.push(i);
    }
    return chunks;
  }

  static getProgress(receivedChunks: Set<number>, totalChunks: number): number {
    if (totalChunks === 0) return 0;
    return Math.round((receivedChunks.size / totalChunks) * 100);
  }
}
