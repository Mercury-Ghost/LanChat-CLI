import { Logger } from 'winston';
import { ClientConnection } from './ClientConnection';
import { MessageType } from '../shared/protocol/types';
import { HEARTBEAT_INTERVAL } from '../shared/constants';

export class HeartbeatService {
  private connection: ClientConnection;
  private logger: Logger;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private socketId: string;

  constructor(connection: ClientConnection, logger: Logger) {
    this.connection = connection;
    this.logger = logger;
    this.socketId = connection.getSocketId();
  }

  start(): void {
    if (this.isRunning) {
      this.logger.debug('心跳服务已在运行', { socketId: this.socketId });
      return;
    }

    this.isRunning = true;

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL);

    this.logger.info('心跳服务已启动', { socketId: this.socketId, interval: HEARTBEAT_INTERVAL });
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.isRunning) {
      this.isRunning = false;
      this.logger.info('心跳服务已停止', { socketId: this.socketId });
    }
  }

  private sendHeartbeat(): void {
    try {
      this.connection.sendMessage(MessageType.HEARTBEAT, {});
      this.logger.debug('发送心跳包', { socketId: this.socketId });
    } catch (error) {
      this.logger.error('发送心跳失败', { socketId: this.socketId, error });
    }
  }

  reset(): void {
    if (this.isRunning) {
      this.logger.debug('重置心跳服务', { socketId: this.socketId });
      this.stop();
      this.start();
    }
  }
}
