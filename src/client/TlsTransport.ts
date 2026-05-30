import tls from 'tls';
import { BaseTransport, Transport } from './Transport';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class TlsTransport extends BaseTransport implements Transport {
  private socket: tls.TLSSocket | null = null;
  private host: string = '';
  private port: number = 0;
  private knownHostsPath: string;

  constructor() {
    super();
    this.knownHostsPath = path.join(os.homedir(), '.lanchat', 'known_hosts');
    this.ensureKnownHostsDir();
  }

  private ensureKnownHostsDir(): void {
    const dir = path.dirname(this.knownHostsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

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
          this.isConnected = true;
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
        this.isConnected = false;
        this.emit('close');
      });

      this.socket.on('error', (error: Error) => {
        this.emit('error', error);
        reject(error);
      });

      this.socket.setTimeout(30000);
    });
  }

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

  send(data: Buffer): void {
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(data);
    }
  }

  close(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.isConnected = false;
  }

  getRemoteFingerprint(): string {
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

  onMessage(callback: (data: Buffer) => void): void {
    this.on('message', callback);
  }

  onClose(callback: () => void): void {
    this.on('close', callback);
  }

  onError(callback: (error: Error) => void): void {
    this.on('error', callback);
  }

  onConnect(callback: () => void): void {
    this.on('connect', callback);
  }
}
