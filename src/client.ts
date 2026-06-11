if (process.platform === 'win32') {
  process.env.CHCP = '65001';
  try {
    const { spawnSync } = require('child_process');
    spawnSync('chcp', ['65001'], { stdio: 'ignore' });
  } catch (e) {}
}

process.stdout.setDefaultEncoding('utf-8');
process.stdin.setDefaultEncoding('utf-8');

import dotenv from 'dotenv';
dotenv.config();

import { Socket } from 'net';
import * as tls from 'tls';
import readline from 'readline';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  MessageType,
  LoginResponsePayload,
  RegisterResponsePayload,
  TokenLoginResponsePayload,
  RoomInfo,
  ChatRoomMessagePayload,
  ChatPrivateMessagePayload,
  SystemMessagePayload,
  HistoryResponsePayload,
  PasswordChangeResponsePayload,
  ErrorResponsePayload,
} from './shared/types';

import { encodeMessage, parseMessages } from './shared/utils';

const HOST = process.env.CHAT_CLIENT_HOST || '47.95.232.197';
const PORT = parseInt(process.env.CHAT_CLIENT_PORT || '3000', 10);
const USE_TLS = process.env.USE_TLS === 'true';
const STORE_DIR = path.join(os.homedir(), '.lanchat');

function saveToken(token: string) {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
  fs.writeFileSync(path.join(STORE_DIR, 'token'), token, 'utf-8');
}

function getToken(): string | null {
  try {
    return fs.readFileSync(path.join(STORE_DIR, 'token'), 'utf-8');
  } catch {
    return null;
  }
}

function clearToken() {
  try {
    fs.unlinkSync(path.join(STORE_DIR, 'token'));
  } catch {}
}

const COMMANDS = [
  '/join', '/leave', '/rooms', '/msg', '/nick', '/list', '/history', '/passwd', '/quit', '/help'
];

interface ChatMessage {
  type: 'room' | 'private' | 'system';
  sender: string;
  content: string;
  timestamp: string;
  room?: string;
  target?: string;
}

class ChatClient {
  private socket: Socket | null = null;
  private recvBuffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  private rl: readline.Interface;
  private token: string | null = null;
  private nickname = '';
  private currentRoom = '#general';
  private state: 'disconnected' | 'connected' | 'authenticated' = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messages: ChatMessage[] = [];
  private maxMessages = 200;
  private currentInput = '';

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '',
      historySize: 100,
      completer: (line: string) => {
        const hits = COMMANDS.filter(c => c.startsWith(line));
        return [hits.length ? hits : COMMANDS, line];
      },
    });

    this.rl.on('line', (line: string) => this.onInput(line));
    this.rl.on('history', () => {});
    this.rl.on('SIGINT', () => this.quit());
  }

  private redrawScreen() {
    console.clear();
    
    console.log(chalk.blue(`=== 局域网聊天室 - ${this.currentRoom} ===`));
    console.log(chalk.gray(`在线用户: ${this.nickname}\n`));
    
    const displayMessages = this.messages.slice(-Math.min(this.messages.length, 50));
    for (const msg of displayMessages) {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      let prefix = chalk.gray(`[${time}]`);
      
      if (msg.type === 'system') {
        console.log(chalk.green(`${prefix} [系统] ${msg.content}`));
      } else if (msg.type === 'private') {
        const direction = msg.sender === this.nickname ? 'to' : 'from';
        const target = msg.sender === this.nickname ? msg.target : msg.sender;
        console.log(chalk.yellow(`${prefix} [PM ${direction} ${target}] ${msg.content}`));
      } else {
        const nameColor = msg.sender === this.nickname ? chalk.cyan : chalk.white;
        console.log(`${prefix} ${nameColor(`<${msg.sender}>`)} ${msg.content}`);
      }
    }
    
    console.log('\n' + '='.repeat(process.stdout.columns || 80));
    process.stdout.write(`> ${this.currentInput}`);
  }

  async start() {
    this.token = getToken();

    if (this.token) {
      const autoLogin = await this.question('检测到已保存的登录状态，是否自动登录? (y/n) ');
      if (autoLogin.toLowerCase() === 'y') {
        await this.connect();
        await this.autoLoginWithToken();
      } else {
        clearToken();
        this.token = null;
        await this.promptLogin();
      }
    } else {
      await this.promptLogin();
    }

    this.rl.prompt();
  }

  private async promptLogin(): Promise<void> {
    console.clear();
    console.log(chalk.blue('=== 局域网聊天室 ===\n'));
    
    const choice = await this.question('登录(1) 还是 注册(2)? ');
    const isLogin = choice.trim() === '1';
    const nickname = await this.question('昵称: ');
    const password = await this.question('密码: ');

    try {
      if (this.socket?.destroyed || !this.socket) {
        await this.connect();
      }

      return new Promise<void>((resolve) => {
        const handler = (type: number, payload: unknown) => {
          if (type === MessageType.LOGIN_RESPONSE) {
            this.offMessage(handler);
            const response = payload as LoginResponsePayload;
            if (response.success) {
              this.token = response.token!;
              saveToken(this.token);
              this.nickname = nickname;
              this.state = 'authenticated';
              console.clear();
              console.log(chalk.green('登录成功！\n'));
              resolve();
            } else {
              console.log(chalk.red(`\n登录失败: ${response.error}`));
              setTimeout(() => this.promptLogin().then(resolve), 2000);
            }
          } else if (type === MessageType.REGISTER_RESPONSE) {
            this.offMessage(handler);
            const response = payload as RegisterResponsePayload;
            if (response.success) {
              console.log(chalk.green('\n注册成功！请登录。'));
              setTimeout(() => this.promptLogin().then(resolve), 2000);
            } else {
              console.log(chalk.red(`\n注册失败: ${response.error}`));
              setTimeout(() => this.promptLogin().then(resolve), 2000);
            }
          }
        };
        this.onMessage(handler);
        if (isLogin) {
          this.send(MessageType.LOGIN_REQUEST, { nickname, password });
        } else {
          this.send(MessageType.REGISTER_REQUEST, { nickname, password });
        }
      });
    } catch (err) {
      console.log(chalk.red(`\n连接失败: ${(err as Error).message}`));
      return this.promptLogin();
    }
  }

  private async autoLoginWithToken() {
    return new Promise<void>((resolve, reject) => {
      const handler = (type: number, payload: unknown) => {
        if (type === MessageType.TOKEN_LOGIN_RESPONSE) {
          this.offMessage(handler);
          const response = payload as TokenLoginResponsePayload;
          if (response.success) {
            this.nickname = response.nickname!;
            this.state = 'authenticated';
            console.log(chalk.green(`欢迎回来，${this.nickname}！`));
            resolve();
          } else {
            console.log(chalk.red(`Token 登录失败: ${response.error}`));
            clearToken();
            this.token = null;
            this.promptLogin().then(resolve).catch(reject);
          }
        }
      };
      this.onMessage(handler);
      this.send(MessageType.TOKEN_LOGIN_REQUEST, { token: this.token });
    });
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (USE_TLS) {
        this.socket = tls.connect({
          host: HOST,
          port: PORT,
          rejectUnauthorized: false,
        });
      } else {
        this.socket = new Socket();
        this.socket.connect(PORT, HOST);
      }

      this.socket.on('connect', () => {
        this.state = 'connected';
        this.recvBuffer = Buffer.alloc(0);
        this.reconnectAttempts = 0;
        this.socket!.on('data', (data: Buffer) => this.onData(data));
        resolve();
      });

      this.socket.on('error', (err: Error) => {
        console.error(chalk.red(`连接失败: ${err.message}`));
        reject(err);
      });

      this.socket.on('close', () => {
        if (this.state === 'authenticated') {
          console.log(chalk.red('连接已断开，尝试重连...'));
          this.state = 'disconnected';
          this.tryReconnect();
        }
      });
    });
  }

  private onData(data: Buffer) {
    this.recvBuffer = Buffer.concat([this.recvBuffer, data]);
    const { messages, remaining } = parseMessages(this.recvBuffer);
    this.recvBuffer = remaining;
    for (const msg of messages) {
      this.dispatchMessage(msg.type, msg.payload);
    }
  }

  private messageListeners: Array<(type: number, payload: unknown) => void> = [];

  private onMessage(fn: (type: number, payload: unknown) => void) {
    this.messageListeners.push(fn);
  }

  private offMessage(fn: (type: number, payload: unknown) => void) {
    this.messageListeners = this.messageListeners.filter(f => f !== fn);
  }

  private dispatchMessage(type: number, payload: unknown) {
    for (const listener of this.messageListeners) {
      listener(type, payload);
    }

    let needRedraw = false;

    switch (type) {
      case MessageType.HEARTBEAT_REQUEST:
        this.send(MessageType.HEARTBEAT_ACK);
        break;
      case MessageType.ERROR_RESPONSE:
        const error = payload as ErrorResponsePayload;
        this.addMessage({ type: 'system', sender: 'system', content: `错误: ${error.message}`, timestamp: new Date().toISOString() });
        needRedraw = true;
        break;
      case MessageType.ROOM_LIST_RESPONSE:
        const roomList = payload as { rooms: RoomInfo[] };
        let roomsText = '房间列表:\n';
        roomList.rooms.forEach((r: RoomInfo) => roomsText += `  ${r.name} (${r.memberCount}人)\n`);
        this.addMessage({ type: 'system', sender: 'system', content: roomsText.trim(), timestamp: new Date().toISOString() });
        needRedraw = true;
        break;
      case MessageType.USER_LIST_RESPONSE:
        const userList = payload as { room: string; users: string[] };
        this.addMessage({ type: 'system', sender: 'system', content: `[${userList.room}] 在线用户: ${userList.users.join(', ')}`, timestamp: new Date().toISOString() });
        needRedraw = true;
        break;
      case MessageType.ROOM_JOIN_RESPONSE:
        const joinResponse = payload as { room: string; success: boolean; error?: string };
        if (!joinResponse.success) {
          this.addMessage({ type: 'system', sender: 'system', content: `加入房间失败: ${joinResponse.error}`, timestamp: new Date().toISOString() });
        } else {
          this.currentRoom = joinResponse.room;
          this.addMessage({ type: 'system', sender: 'system', content: `已加入房间: ${joinResponse.room}`, timestamp: new Date().toISOString() });
        }
        needRedraw = true;
        break;
      case MessageType.SYSTEM_MESSAGE:
        const systemMsg = payload as SystemMessagePayload;
        this.addMessage({ type: 'system', sender: 'system', content: systemMsg.text, timestamp: systemMsg.timestamp });
        needRedraw = true;
        break;
      case MessageType.CHAT_ROOM_MESSAGE:
        const roomMsg = payload as ChatRoomMessagePayload;
        this.addMessage({ type: 'room', sender: roomMsg.sender, content: roomMsg.text, timestamp: roomMsg.timestamp, room: roomMsg.room });
        needRedraw = true;
        break;
      case MessageType.CHAT_PRIVATE_MESSAGE:
        const pm = payload as ChatPrivateMessagePayload;
        this.addMessage({ type: 'private', sender: pm.sender, content: pm.text, timestamp: pm.timestamp, target: pm.target });
        needRedraw = true;
        break;
      case MessageType.HISTORY_RESPONSE:
        const historyMessages = (payload as HistoryResponsePayload).messages;
        for (const msg of historyMessages) {
          this.addMessage({ type: 'room', sender: msg.sender, content: msg.content, timestamp: msg.timestamp });
        }
        needRedraw = true;
        break;
      case MessageType.NICK_CHANGE_RESPONSE:
        const nickChange = payload as { success: boolean; newNickname?: string; error?: string };
        if (nickChange.success) {
          this.addMessage({ type: 'system', sender: 'system', content: `昵称已更改为 ${nickChange.newNickname}`, timestamp: new Date().toISOString() });
          this.nickname = nickChange.newNickname!;
        } else {
          this.addMessage({ type: 'system', sender: 'system', content: `改名失败: ${nickChange.error}`, timestamp: new Date().toISOString() });
        }
        needRedraw = true;
        break;
      case MessageType.PASSWORD_CHANGE_RESPONSE:
        const pwdChange = payload as PasswordChangeResponsePayload;
        if (pwdChange.success) {
          this.addMessage({ type: 'system', sender: 'system', content: '密码修改成功！', timestamp: new Date().toISOString() });
        } else {
          this.addMessage({ type: 'system', sender: 'system', content: `密码修改失败: ${pwdChange.error}`, timestamp: new Date().toISOString() });
        }
        needRedraw = true;
        break;
    }

    if (needRedraw && this.state === 'authenticated') {
      this.redrawScreen();
    }
  }

  private addMessage(msg: ChatMessage) {
    this.messages.push(msg);
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  private displayRoomMessage(msg: ChatRoomMessagePayload) {
    const prefix = msg.sender === this.nickname
      ? chalk.cyan(`[${msg.room}] <${msg.sender}>`)
      : chalk.white(`[${msg.room}] <${msg.sender}>`);
    console.log(`${prefix} ${msg.text}`);
  }

  private displayHistory(messages: { sender: string; content: string; timestamp: string }[]) {
    console.log(chalk.blue('--- 历史消息 ---'));
    for (const msg of messages) {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      console.log(chalk.gray(`[${time}]`) + ` ${msg.sender}: ${msg.content}`);
    }
    console.log(chalk.blue('--- 结束 ---'));
  }

  private send(type: number, payload?: object) {
    if (this.socket && !this.socket.destroyed) {
      this.socket.write(encodeMessage(type, payload));
    }
  }

  private sendWithToken(type: number, payload: object) {
    this.send(type, { ...payload, token: this.token });
  }

  private onInput(input: string) {
    this.currentInput = '';
    
    const trimmed = input.trim();
    if (!trimmed) {
      this.rl.prompt();
      return;
    }

    if (trimmed.startsWith('/')) {
      const parts = trimmed.slice(1).split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      switch (cmd) {
        case 'join':
          this.cmdJoin(args[0]);
          break;
        case 'leave':
          this.cmdLeave();
          break;
        case 'rooms':
          this.send(MessageType.ROOM_LIST_REQUEST, {});
          break;
        case 'msg':
          this.cmdMsg(args);
          break;
        case 'nick':
          this.cmdNick(args[0]);
          break;
        case 'list':
          this.send(MessageType.USER_LIST_REQUEST, { room: this.currentRoom });
          break;
        case 'history':
          this.cmdHistory(args);
          break;
        case 'passwd':
          this.cmdPasswd();
          break;
        case 'quit':
          this.quit();
          break;
        case 'help':
          this.cmdHelp();
          break;
        default:
          this.addMessage({ type: 'system', sender: 'system', content: '未知命令，输入 /help 查看帮助', timestamp: new Date().toISOString() });
          this.redrawScreen();
      }
    } else {
      const timestamp = new Date().toISOString();
      this.addMessage({ type: 'room', sender: this.nickname, content: trimmed, timestamp, room: this.currentRoom });
      this.send(MessageType.CHAT_ROOM_MESSAGE, {
        room: this.currentRoom,
        text: trimmed,
        sender: this.nickname,
        timestamp,
      });
      this.redrawScreen();
    }

    this.rl.prompt();
  }

  private cmdJoin(roomName?: string) {
    if (!roomName || !roomName.startsWith('#')) {
      this.addMessage({ type: 'system', sender: 'system', content: '用法: /join #房间名', timestamp: new Date().toISOString() });
      this.redrawScreen();
      return;
    }
    this.send(MessageType.ROOM_JOIN_REQUEST, { roomName });
    this.currentRoom = roomName;
  }

  private cmdLeave() {
    this.send(MessageType.ROOM_LEAVE_REQUEST, { roomName: this.currentRoom });
    this.currentRoom = '#general';
    this.addMessage({ type: 'system', sender: 'system', content: '已离开房间，返回 #general', timestamp: new Date().toISOString() });
    this.redrawScreen();
  }

  private cmdMsg(args: string[]) {
    if (args.length < 2) {
      this.addMessage({ type: 'system', sender: 'system', content: '用法: /msg <昵称> <消息>', timestamp: new Date().toISOString() });
      this.redrawScreen();
      return;
    }
    const timestamp = new Date().toISOString();
    this.addMessage({ type: 'private', sender: this.nickname, content: args.slice(1).join(' '), timestamp, target: args[0] });
    this.send(MessageType.CHAT_PRIVATE_MESSAGE, {
      target: args[0],
      text: args.slice(1).join(' '),
      sender: this.nickname,
      timestamp,
    });
    this.redrawScreen();
  }

  private cmdNick(newNick?: string) {
    if (!newNick) {
      this.addMessage({ type: 'system', sender: 'system', content: '用法: /nick <新昵称>', timestamp: new Date().toISOString() });
      this.redrawScreen();
      return;
    }
    this.send(MessageType.NICK_CHANGE_REQUEST, { newNickname: newNick });
  }

  private cmdHistory(args: string[]) {
    if (args.length === 0) {
      this.send(MessageType.HISTORY_REQUEST, { type: 'room', room: this.currentRoom, count: 50 });
      return;
    }

    let target: string | undefined;
    let count = 50;

    if (args[0].startsWith('@')) {
      target = args[0].slice(1);
      if (args[1]) {
        count = Math.min(parseInt(args[1]) || 50, 200);
      }
      this.send(MessageType.HISTORY_REQUEST, { type: 'private', target, count });
    } else {
      count = Math.min(parseInt(args[0]) || 50, 200);
      this.send(MessageType.HISTORY_REQUEST, { type: 'room', room: this.currentRoom, count });
    }
  }

  private async cmdPasswd() {
    const oldPassword = await this.question('旧密码: ');
    const newPassword = await this.question('新密码: ');
    const confirmPassword = await this.question('确认新密码: ');

    if (newPassword !== confirmPassword) {
      this.addMessage({ type: 'system', sender: 'system', content: '两次输入的密码不一致', timestamp: new Date().toISOString() });
      this.redrawScreen();
      return;
    }

    this.send(MessageType.PASSWORD_CHANGE_REQUEST, { oldPassword, newPassword });
  }

  private cmdHelp() {
    let helpText = '=== 命令帮助 ===\n';
    helpText += '/join #房间名 - 加入指定房间\n';
    helpText += '/leave - 离开当前房间，返回 #general\n';
    helpText += '/rooms - 列出所有房间\n';
    helpText += '/msg <昵称> <消息> - 发送私聊消息\n';
    helpText += '/nick <新昵称> - 修改昵称\n';
    helpText += '/list - 列出当前房间在线用户\n';
    helpText += '/history [@昵称] [数量] - 查看历史消息\n';
    helpText += '/passwd - 修改密码\n';
    helpText += '/quit - 退出聊天室\n';
    helpText += '/help - 显示此帮助信息';
    this.addMessage({ type: 'system', sender: 'system', content: helpText, timestamp: new Date().toISOString() });
    this.redrawScreen();
  }

  private quit() {
    this.send(MessageType.DISCONNECT_REQUEST, { reason: '用户退出' });
    this.socket?.destroy();
    this.rl.close();
    process.exit(0);
  }

  private question(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  }

  private tryReconnect() {
    if (this.reconnectAttempts >= 5) {
      console.log(chalk.red('重连失败次数过多，程序退出。'));
      process.exit(1);
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 16000);
    this.reconnectAttempts++;
    console.log(`将在 ${delay / 1000} 秒后尝试重连...`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        if (this.token) {
          await this.autoLoginWithToken();
          console.log(chalk.green('连接已恢复！'));
        } else {
          console.log(chalk.yellow('连接已恢复，但需要重新登录。'));
          await this.promptLogin();
        }
      } catch {
        this.tryReconnect();
      }
    }, delay);
  }
}

const client = new ChatClient();
client.start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});