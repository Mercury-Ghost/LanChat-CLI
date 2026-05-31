import tls from 'tls';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BaseTransport } from './Transport';

/**
 * TLS 传输层类
 * 
 * @description 基于 TLS/SSL 的安全传输层实现，负责与服务器建立加密连接并处理数据传输
 *              支持证书验证、已知主机管理和心跳检测等功能
 * 
 * @extends BaseTransport
 * 
 * @example
 * ```typescript
 * const transport = new TlsTransport();
 * 
 * transport.on('connect', () => {
 *   console.log('连接成功');
 * });
 * 
 * transport.on('message', (data) => {
 *   console.log('收到数据:', data);
 * });
 * 
 * await transport.connect('localhost', 9527);
 * ```
 */
export class TlsTransport extends BaseTransport {
  /** TLS 套接字实例 */
  private socket: tls.TLSSocket | null = null;
  
  /** 目标服务器主机地址 */
  private host: string = '';
  
  /** 目标服务器端口 */
  private port: number = 0;
  
  /** 已知主机指纹存储路径 */
  private knownHostsPath: string;

  /**
   * 构造函数
   * 
   * @description 初始化 TLS 传输层，设置已知主机存储路径
   */
  constructor() {
    super();
    this.knownHostsPath = path.join(os.homedir(), '.lanchat', 'known_hosts');
    this.ensureKnownHostsDir();
  }

  /**
   * 确保已知主机目录存在
   * 
   * @private
   * @description 检查并创建存储已知主机指纹的目录
   */
  private ensureKnownHostsDir(): void {
    const dir = path.dirname(this.knownHostsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 连接到 TLS 服务器
   * 
   * @param host - 服务器主机地址
   * @param port - 服务器端口号
   * @returns {Promise<void>} 连接成功后 resolve
   * @throws {Error} 连接失败或 TLS 握手失败时抛出错误
   * 
   * @description 与服务器建立 TLS 连接，执行证书验证并设置事件监听
   */
  async connect(host: string, port: number): Promise<void> {
    this.host = host;
    this.port = port;

    return new Promise((resolve, reject) => {
      const options: tls.ConnectionOptions = {
        rejectUnauthorized: false,
        checkServerIdentity: (servername, cert) => {
          return this.verifyCertificate(cert);
        },
      };

      this.socket = tls.connect(port, host, options, () => {
        if (this.socket?.authorized) {
          console.log('TLS 连接已建立');
          this.isSocketConnected = true;
          this.emit('connect');
          resolve();
        } else {
          reject(new Error('TLS 握手失败'));
        }
      });

      this.socket.on('data', (data: Buffer) => {
        this.emit('message', data);
      });

      this.socket.on('close', () => {
        this.isSocketConnected = false;
        this.emit('close');
      });

      this.socket.on('error', (error: Error) => {
        this.emit('error', error);
        reject(error);
      });

      this.socket.setTimeout(30000);
    });
  }

  /**
   * 验证服务器证书
   * 
   * @private
   * @param cert - 服务器证书
   * @returns {Error | undefined} 验证失败返回错误，否则返回 undefined
   * 
   * @description 检查服务器证书指纹是否与已知主机匹配，防止中间人攻击
   */
  private verifyCertificate(cert: tls.PeerCertificate): Error | undefined {
    const fingerprint = this.getRemoteFingerprint();
    const hostKey = `${this.host}:${this.port}`;

    if (fs.existsSync(this.knownHostsPath)) {
      try {
        const knownHosts = JSON.parse(fs.readFileSync(this.knownHostsPath, 'utf8')) as Record<string, string>;
        const knownFingerprint = knownHosts[hostKey];

        if (knownFingerprint && knownFingerprint !== fingerprint) {
          const errorMsg = `服务器证书指纹不匹配! 预期: ${knownFingerprint}, 实际: ${fingerprint}`;
          console.error(errorMsg);
          return new Error(errorMsg);
        }
      } catch {
        console.warn('警告: known_hosts 文件格式错误，将被覆盖');
      }
    } else {
      console.log('首次连接，请验证服务器证书指纹:');
      console.log(`SHA-256: ${fingerprint}`);
    }
    return undefined;
  }

  /**
   * 发送数据
   * 
   * @param data - 要发送的数据缓冲区
   * @returns {void}
   * 
   * @description 通过 TLS 连接发送数据
   */
  send(data: Buffer): void {
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(data);
    }
  }

  /**
   * 关闭连接
   * 
   * @returns {void}
   * 
   * @description 销毁 TLS 连接并清理资源
   */
  close(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.isSocketConnected = false;
  }

  /**
   * 获取远程证书指纹
   * 
   * @private
   * @returns {string} SHA-256 证书指纹
   * 
   * @description 计算当前连接的服务器证书指纹
   */
  private getRemoteFingerprint(): string {
    if (!this.socket) {
      return '';
    }

    const cert = this.socket.getPeerCertificate();
    if (!cert || !cert.raw) {
      return '';
    }

    const sha256 = crypto.createHash('sha256');
    sha256.update(cert.raw);
    return sha256.digest('hex');
  }

  /**
   * 保存已知主机
   * 
   * @returns {void}
   * 
   * @description 将当前服务器证书指纹保存到已知主机列表
   */
  saveKnownHost(): void {
    const fingerprint = this.getRemoteFingerprint();
    if (!fingerprint) {
      return;
    }

    const hostKey = `${this.host}:${this.port}`;
    let knownHosts: Record<string, string> = {};

    if (fs.existsSync(this.knownHostsPath)) {
      try {
        knownHosts = JSON.parse(fs.readFileSync(this.knownHostsPath, 'utf8')) as Record<string, string>;
      } catch {
        console.warn('警告: known_hosts 文件格式错误，将重新初始化');
      }
    }

    knownHosts[hostKey] = fingerprint;
    fs.writeFileSync(this.knownHostsPath, JSON.stringify(knownHosts, null, 2));
  }

  /**
   * 设置消息处理回调
   * 
   * @param callback - 消息回调函数
   */
  onMessage(callback: (data: Buffer) => void): void {
    this.on('message', callback);
  }

  /**
   * 设置连接关闭回调
   * 
   * @param callback - 关闭回调函数
   */
  onClose(callback: () => void): void {
    this.on('close', callback);
  }

  /**
   * 设置错误处理回调
   * 
   * @param callback - 错误回调函数
   */
  onError(callback: (error: Error) => void): void {
    this.on('error', callback);
  }

  /**
   * 设置连接成功回调
   * 
   * @param callback - 连接回调函数
   */
  onConnect(callback: () => void): void {
    this.on('connect', callback);
  }
}
