import { EventEmitter } from 'events';

export interface Transport {
  connect(host: string, port: number): Promise<void>;
  send(data: Buffer): void;
  on(event: 'message' | 'close' | 'error' | 'connect', listener: (...args: any[]) => void): void;
  onMessage(callback: (data: Buffer) => void): void;
  onClose(callback: () => void): void;
  onError(callback: (error: Error) => void): void;
  onConnect(callback: () => void): void;
  close(): void;
  getRemoteFingerprint?(): string;
}

export abstract class BaseTransport extends EventEmitter {
  protected isConnected: boolean = false;

  abstract connect(host: string, port: number): Promise<void>;
  abstract send(data: Buffer): void;
  abstract close(): void;
  abstract getRemoteFingerprint?(): string;

  get isOpen(): boolean {
    return this.isConnected;
  }
}
