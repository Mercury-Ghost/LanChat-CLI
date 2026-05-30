import { Logger } from 'winston';
import { ClientConnection } from './ClientConnection';
import { MessageType } from '../shared/protocol/types';
import { HEARTBEAT_INTERVAL } from '../shared/constants';

export class HeartbeatService {
  private connection: ClientConnection;
  private logger: Logger;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(connection: ClientConnection, logger: Logger) {
    this.connection = connection;
    this.logger = logger;
  }

  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL);

    this.logger.debug('心跳服务已启动');
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.isRunning = false;
    this.logger.debug('心跳服务已停止');
  }

  private sendHeartbeat(): void {
    try {
      this.connection.sendMessage(MessageType.HEARTBEAT, {});
      this.logger.debug('发送心跳包');
    } catch (error) {
      this.logger.error('发送心跳失败', { error });
    }
  }

  reset(): void {
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}
