import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * 本地存储管理器
 * @description 管理客户端本地配置数据，包括认证令牌、用户设置等
 */
export class LocalStore {
  private storePath: string;
  private data: {
        token?: string;
        nickname?: string;
        knownHosts?: Record<string, string>;
        settings?: Record<string, unknown>;
    };

  constructor() {
    this.storePath = path.join(os.homedir(), '.lanchat', 'config.json');
    this.data = this.load();
  }

  private ensureDir(): void {
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private load(): typeof this.data {
    this.ensureDir();
    if (fs.existsSync(this.storePath)) {
      try {
        const content = fs.readFileSync(this.storePath, 'utf8');
        return JSON.parse(content);
      } catch {
        return {};
      }
    }
    return {};
  }

  private save(): void {
    this.ensureDir();
    fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2));
  }

  getToken(): string | undefined {
    return this.data.token;
  }

  saveToken(token: string): void {
    this.data.token = token;
    this.save();
  }

  getNickname(): string | undefined {
    return this.data.nickname;
  }

  saveNickname(nickname: string): void {
    this.data.nickname = nickname;
    this.save();
  }

  clearToken(): void {
    delete this.data.token;
    this.save();
  }

  getKnownHost(host: string): string | undefined {
    return this.data.knownHosts?.[host];
  }

  saveKnownHost(host: string, fingerprint: string): void {
    if (!this.data.knownHosts) {
      this.data.knownHosts = {};
    }
    this.data.knownHosts[host] = fingerprint;
    this.save();
  }

  removeKnownHost(host: string): void {
    if (this.data.knownHosts) {
      delete this.data.knownHosts[host];
      this.save();
    }
  }

  getSetting<T>(key: string, defaultValue: T): T {
    return (this.data.settings?.[key] as T) ?? defaultValue;
  }

  setSetting<T>(key: string, value: T): void {
    if (!this.data.settings) {
      this.data.settings = {};
    }
    this.data.settings[key] = value;
    this.save();
  }

  clear(): void {
    this.data = {};
    this.save();
  }
}
