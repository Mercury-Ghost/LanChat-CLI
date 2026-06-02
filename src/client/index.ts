import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { ChatClient } from './ChatClient';
import { TuiManager } from './TuiManager';
import { DEFAULT_HOST, DEFAULT_PORT } from '../shared/constants';

dotenv.config();

interface ClientConfig {
  host: string;
  port: number;
  trustedFingerprints: string[];
}

class LanChatClient {
  private client: ChatClient;
  private tui: TuiManager | null = null;
  private rl: readline.Interface | null = null;
  private config: ClientConfig | null = null;

  constructor() {
    this.client = new ChatClient();
  }

  async start(): Promise<void> {
    this.printWelcome();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    await this.loadConfig();

    const host = await this.prompt('服务器地址', this.config?.host || DEFAULT_HOST);
    const port = parseInt(await this.prompt('端口', (this.config?.port || DEFAULT_PORT).toString()), 10);

    this.tui = new TuiManager();
    this.client.setTui(this.tui);

    try {
      await this.client.connect(host, port, async (fingerprint, isFirstConnection) => {
        return await this.verifyFingerprint(fingerprint, isFirstConnection);
      });

      this.config = {
        host,
        port,
        trustedFingerprints: this.config?.trustedFingerprints || [],
      };
      await this.saveConfig();

      this.tui.start();

      await this.handleAuth();

      this.setupCommandHandlers();
    } catch (error) {
      console.error('连接失败:', error);
      process.exit(1);
    }
  }

  private async loadConfig(): Promise<void> {
    const configPath = this.getConfigPath();
    if (fs.existsSync(configPath)) {
      try {
        const content = await fs.promises.readFile(configPath, 'utf8');
        this.config = JSON.parse(content);
      } catch {
        this.config = null;
      }
    }
  }

  private async saveConfig(): Promise<void> {
    if (!this.config) return;
    const configPath = this.getConfigPath();
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
    await fs.promises.writeFile(configPath, JSON.stringify(this.config, null, 2));
  }

  private getConfigPath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
    return path.join(homeDir, '.lanchat', 'config.json');
  }

  private async verifyFingerprint(fingerprint: string, isFirstConnection: boolean): Promise<boolean> {
    if (!isFirstConnection) {
      return true;
    }

    console.log('\n⚠️  首次连接此服务器，证书指纹如下：');
    console.log(`   ${fingerprint}`);
    
    const answer = await this.prompt('是否信任此证书? (y/N)', 'N');
    return answer.toLowerCase() === 'y';
  }

  private printWelcome(): void {
    console.log('╔════════════════════════════════════╗');
    console.log('║        LanChat CLI v1.0.0          ║');
    console.log('║     局域网聊天室 - 终端版           ║');
    console.log('╚════════════════════════════════════╝');
    console.log();
  }

  private prompt(question: string, defaultValue: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl!.question(`${question} [${defaultValue}]: `, (answer) => {
        resolve(answer.trim() || defaultValue);
      });
    });
  }

  private async handleAuth(): Promise<void> {
    const action = await this.promptSelect('请选择操作', ['登录', '注册']);

    if (action === '1') {
      await this.handleLogin();
    } else {
      await this.handleRegister();
    }
  }

  private async handleLogin(): Promise<void> {
    const nickname = await this.prompt('昵称', '');
    const password = await this.promptPassword('密码');

    try {
      await this.client.login(nickname, password);
      console.log('登录成功!');
    } catch (error) {
      console.error('登录失败:', error);
      await this.handleAuth();
    }
  }

  private async handleRegister(): Promise<void> {
    const nickname = await this.prompt('选择昵称', '');
    const password = await this.promptPassword('设置密码');

    try {
      await this.client.register(nickname, password);
      console.log('注册成功! 请登录。');
      await this.handleLogin();
    } catch (error) {
      console.error('注册失败:', error);
      await this.handleAuth();
    }
  }

  private promptSelect(question: string, options: string[]): Promise<string> {
    return new Promise((resolve) => {
      console.log(`${question}:`);
      options.forEach((opt, i) => {
        console.log(`  ${i + 1}. ${opt}`);
      });

      this.rl!.question('> ', (answer) => {
        const num = parseInt(answer, 10);
        if (num >= 1 && num <= options.length) {
          resolve(num.toString());
        } else {
          resolve('1');
        }
      });
    });
  }

  private promptPassword(question: string): Promise<string> {
    return new Promise((resolve) => {
      process.stdout.write(`${question}: `);
      
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      let password = '';
      
      const onData = (char: string) => {
        switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u007F':
        case '\b':
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(`${question}: ${'*'.repeat(password.length)}`);
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
        }
      };
      
      process.stdin.on('data', onData);
    });
  }

  private setupCommandHandlers(): void {
    this.client.on('message', (msg) => {
      this.tui?.appendMessage(msg);
    });

    this.client.on('error', (error) => {
      console.error('错误:', error);
    });

    this.client.on('close', () => {
      console.log('连接已关闭');
      this.tui?.stop();
      process.exit(0);
    });
  }
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n正在退出...');
  process.exit(0);
});

const app = new LanChatClient();
app.start();
