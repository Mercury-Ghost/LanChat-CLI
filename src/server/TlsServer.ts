import tls from 'tls';
import { Server as NetServer, Socket } from 'net';
import { Database } from './Database';
import { ClientConnection } from './ClientConnection';
import { Logger } from 'winston';
import { CERT_PATH, KEY_PATH, SERVER_PORT } from '../shared/constants';
import * as fs from 'fs';
import * as path from 'path';

export class TlsServer {
  private server: tls.Server | null = null;
  private connections: Map<string, ClientConnection> = new Map();
  private database: Database;
  private logger: Logger;

  constructor(database: Database, logger: Logger) {
    this.database = database;
    this.logger = logger;
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

    const connection = new ClientConnection(socket, socketId, this.database, this.logger, this);
    this.connections.set(socketId, connection);

    this.logger.info('新连接', { socketId });

    connection.on('close', () => {
      this.connections.delete(socketId);
      this.logger.info('连接关闭', { socketId });
    });
  }

  getConnection(socketId: string): ClientConnection | undefined {
    return this.connections.get(socketId);
  }

  getAllConnections(): Map<string, ClientConnection> {
    return this.connections;
  }

  broadcast(message: Buffer, excludeSocketIds?: string[]): void {
    for (const [socketId, connection] of this.connections) {
      if (!excludeSocketIds?.includes(socketId)) {
        connection.send(message);
      }
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
