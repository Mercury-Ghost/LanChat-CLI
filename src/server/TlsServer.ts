import tls from 'tls';
import { Socket } from 'net';
import { Database } from './Database';
import { ClientConnection } from './ClientConnection';
import { Logger } from 'winston';
import { CERT_PATH, KEY_PATH, SERVER_PORT, MAX_CONNECTIONS } from '../shared/constants';
import * as fs from 'fs';
import * as path from 'path';
import { RoomManager } from './RoomManager';
import { UserManager } from './UserManager';
import { AuthManager } from './AuthManager';
import { RateLimiter } from './RateLimiter';

export class TlsServer {
  private server: tls.Server | null = null;
  private connections: Map<string, ClientConnection> = new Map();
  private database: Database;
  private logger: Logger;
  private roomManager: RoomManager;
  private userManager: UserManager;
  private authManager: AuthManager;
  private rateLimiter: RateLimiter;

  constructor(database: Database, logger: Logger) {
    this.database = database;
    this.logger = logger;
    this.roomManager = new RoomManager(database, logger);
    this.userManager = new UserManager(logger);
    this.authManager = new AuthManager(database);
    this.rateLimiter = new RateLimiter({
      requestsPerWindow: 60,
      windowMs: 60000,
    });
  }

  async start(): Promise<void> {
    const certPath = path.resolve(CERT_PATH);
    const keyPath = path.resolve(KEY_PATH);

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error(`证书文件不存在: ${certPath}, ${keyPath}`);
    }

    const options: tls.TlsOptions = {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
      minVersion: 'TLSv1.2' as const,
    };

    this.server = tls.createServer(options);
    this.setupEventHandlers();

    return new Promise((resolve, reject) => {
            this.server!.listen(SERVER_PORT, () => {
              this.logger.info(`服务器监听端口 ${SERVER_PORT}`);
              resolve();
            });

            this.server!.on('error', (err) => {
              this.logger.error('服务器错误', { error: err });
              reject(err);
            });
    });
  }

  private setupEventHandlers(): void {
    if (!this.server) return;

    this.server.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });

    this.server.on('secureConnection', (socket: tls.TLSSocket) => {
      this.logger.info('TLS 连接已建立', {
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort,
      });
    });
  }

  private handleConnection(socket: Socket): void {
    const socketId = `${socket.remoteAddress}:${socket.remotePort}`;

    if (this.connections.size >= MAX_CONNECTIONS) {
      this.logger.warn('连接数已达上限，拒绝新连接', {
        socketId,
        currentConnections: this.connections.size,
        maxConnections: MAX_CONNECTIONS
      });
      socket.end();
      return;
    }

    const connection = new ClientConnection(
      socket,
      socketId,
      this.database,
      this.logger,
      this,
      this.authManager,
      this.userManager,
      this.roomManager,
      this.rateLimiter
    );
    this.connections.set(socketId, connection);

    this.logger.info('新连接', { socketId, currentConnections: this.connections.size, maxConnections: MAX_CONNECTIONS });

    connection.on('close', () => {
      this.connections.delete(socketId);
      this.logger.info('连接关闭', { socketId, currentConnections: this.connections.size });
    });
  }

  getConnection(socketId: string): ClientConnection | undefined {
    return this.connections.get(socketId);
  }

  getAllConnections(): Map<string, ClientConnection> {
    // 返回 Map 的副本，避免外部直接修改内部数据结构
    return new Map(this.connections);
  }

  getRoomManager(): RoomManager {
    return this.roomManager;
  }

  getUserManager(): UserManager {
    return this.userManager;
  }

  getAuthManager(): AuthManager {
    return this.authManager;
  }

  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  broadcast(message: Buffer, excludeSocketIds?: string[]): void {
    for (const [socketId, connection] of this.connections) {
      if (!excludeSocketIds?.includes(socketId)) {
        connection.send(message);
      }
    }
  }

  broadcastToRoom(roomName: string, message: Buffer, excludeSocketIds?: string[]): void {
    try {
      const userSocketIds = this.userManager.getUsersInRoomSocketIds(roomName);
      for (const socketId of userSocketIds) {
        if (!excludeSocketIds?.includes(socketId)) {
          const connection = this.connections.get(socketId);
          if (connection) {
            connection.send(message);
          }
        }
      }
      this.logger.debug('广播到房间', { roomName, userCount: userSocketIds.length });
    } catch (error) {
      this.logger.error('房间广播失败', { roomName, error });
    }
  }

  async stop(): Promise<void> {
    for (const connection of this.connections.values()) {
      connection.close();
    }

    return new Promise((resolve) => {
      this.server?.close(() => {
        this.logger.info('服务器已停止');
        resolve();
      });
    });
  }
}
