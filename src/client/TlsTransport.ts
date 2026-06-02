import tls from 'tls';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import dotenv from 'dotenv';
import { BaseTransport } from './Transport';

/**
 * 证书验证回调函数类型
 */
export type CertificateVerifyCallback = (
  fingerprint: string,
  isFirstConnection: boolean
) => Promise<boolean>;

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
 * await transport.connect('localhost', 9527, async (fingerprint, isFirst) => {
 *   if (isFirst) {
 *     return confirm('信任此证书?');
 *   }
 *   return true;
 * });
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

  /** 是否为开发环境 */
  private isDev: boolean;

  /** 证书指纹 */
  private currentFingerprint: string = '';

  /**
   * 构造函数
   * 
   * @description 初始化 TLS 传输层，设置已知主机存储路径
   */
  constructor() {
    super();
    dotenv.config();
    this.knownHostsPath = path.join(os.homedir(), '.lanchat', 'known_hosts');
    this.isDev = process.env.NODE_ENV !== 'production';
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
   * @param verifyCallback - 证书验证回调函数
   * @returns {Promise<void>} 连接成功后 resolve
   * @throws {Error} 连接失败或 TLS 握手失败时抛出错误
   * 
   * @description 与服务器建立 TLS 连接，在握手阶段执行证书验证并设置事件监听
   */
  async connect(
    host: string, 
    port: number, 
    verifyCallback?: CertificateVerifyCallback
  ): Promise<void> {
    this.host = host;
    this.port = port;

    let trustedFingerprint: string | null = null;
    let isFirstConnection = true;
    
    const hostKey = `${this.host}:${this.port}`;
    if (fs.existsSync(this.knownHostsPath)) {
      try {
        const knownHosts = JSON.parse(fs.readFileSync(this.knownHostsPath, 'utf8')) as Record<string, string>;
        trustedFingerprint = knownHosts[hostKey] || null;
        isFirstConnection = !trustedFingerprint;
      } catch {
        console.warn('警告: known_hosts 文件格式错误，将被覆盖');
      }
    }

    return new Promise((resolve, reject) => {
      const options: tls.ConnectionOptions = {
        rejectUnauthorized: false,
        checkServerIdentity: (hostname, cert) => {
          return this.checkServerIdentity(hostname, cert, trustedFingerprint);
        },
      };

      let certificateVerified = !verifyCallback;
      let tempFingerprint = '';

      this.socket = tls.connect(port, host, options, async () => {
        if (!this.socket) {
          reject(new Error('Socket 未初始化'));
          return;
        }

        tempFingerprint = this.getFingerprint(this.socket.getPeerCertificate());

        if (verifyCallback && !certificateVerified) {
          try {
            const isTrusted = await verifyCallback(tempFingerprint, isFirstConnection);
            if (!isTrusted) {
              this.socket?.destroy();
              reject(new Error('证书验证失败'));
              return;
            }

            if (isFirstConnection) {
              this.saveFingerprint(tempFingerprint);
            }

            certificateVerified = true;
            this.currentFingerprint = tempFingerprint;
          } catch (error) {
            this.socket?.destroy();
            reject(error instanceof Error ? error : new Error('证书验证过程出错'));
            return;
          }
        } else {
          this.currentFingerprint = tempFingerprint;
        }

        console.log('TLS 连接已建立');
        this.isSocketConnected = true;
        this.emit('connect');
        resolve();
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
   * 检查服务器身份
   * 
   * @private
   * @param hostname - 主机名
   * @param cert - 服务器证书
   * @param trustedFingerprint - 信任的证书指纹
   * @returns {Error | undefined} 验证失败返回错误，否则返回 undefined
   */
  private checkServerIdentity(
    hostname: string, 
    cert: tls.PeerCertificate,
    trustedFingerprint: string | null
  ): Error | undefined {
    if (!trustedFingerprint) {
      return undefined;
    }

    const fingerprint = this.getFingerprint(cert);
    
    if (fingerprint !== trustedFingerprint) {
      const errorMsg = `服务器证书指纹不匹配! 预期: ${trustedFingerprint}, 实际: ${fingerprint}`;
      console.error(errorMsg);
      return new Error(errorMsg);
    }

    return undefined;
  }

  /**
   * 获取证书指纹
   * 
   * @private
   * @param cert - 服务器证书
   * @returns {string} SHA-256 证书指纹
   * 
   * @description 计算证书的 SHA-256 指纹
   */
  private getFingerprint(cert: tls.PeerCertificate): string {
    if (!cert || !cert.raw) {
      return '';
    }

    const sha256 = crypto.createHash('sha256');
    sha256.update(cert.raw);
    const hash = sha256.digest('hex');
    return hash.match(/.{2}/g)?.join(':').toUpperCase() || '';
  }

  /**
   * 保存证书指纹到已知主机
   * 
   * @private
   * @param fingerprint - 证书指纹
   */
  private saveFingerprint(fingerprint: string): void {
    const hostKey = `${this.host}:${this.port}`;
    let knownHosts: Record<string, string> = {};

    if (fs.existsSync(this.knownHostsPath)) {
      try {
        knownHosts = JSON.parse(fs.readFileSync(this.knownHostsPath, 'utf8')) as Record<string, string>;
      } catch {
        console.warn('警告: known_hosts 文件格式错误，将被覆盖');
      }
    }

    knownHosts[hostKey] = fingerprint;
    fs.writeFileSync(this.knownHostsPath, JSON.stringify(knownHosts, null, 2));
    console.log(`已保存主机 ${hostKey} 的证书指纹`);
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
   * 获取服务器证书指纹
   * 
   * @returns {string} SHA-256 证书指纹，如果未连接则返回空字符串
   * 
   * @description 获取当前连接的服务器证书指纹，用于证书验证和安全检查
   */
  getServerFingerprint(): string {
    return this.currentFingerprint;
  }
}
