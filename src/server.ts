process.stdout.setDefaultEncoding('utf-8');

import dotenv from 'dotenv';
dotenv.config();

import { createServer, Socket, Server } from 'net';
import * as tls from 'tls';
import * as crypto from 'crypto';
import initSqlJs from 'sql.js';
type SqlDatabase = Awaited<ReturnType<typeof initSqlJs>>['Database'];
import * as jwt from 'jsonwebtoken';
import winston from 'winston';
import { argon2id, argon2Verify } from 'hash-wasm';
import fs from 'fs';
import path from 'path';

import {
  MessageType,
  User,
  Room,
  RoomInfo,
  Message,
  PrivateMessage,
  UserState,
  LoginRequestPayload,
  LoginResponsePayload,
  RegisterRequestPayload,
  RegisterResponsePayload,
  TokenLoginRequestPayload,
  TokenLoginResponsePayload,
  TokenRefreshRequestPayload,
  TokenRefreshResponsePayload,
  TokenInvalidateRequestPayload,
  TokenInvalidateResponsePayload,
  RoomJoinRequestPayload,
  RoomJoinResponsePayload,
  ChatRoomMessagePayload,
  ChatPrivateMessagePayload,
  SystemMessagePayload,
  HistoryRequestPayload,
  HistoryResponsePayload,
  HistoryMessage,
  PasswordChangeRequestPayload,
  PasswordChangeResponsePayload,
  ErrorResponsePayload,
} from './shared/types';

import {
  encodeMessage,
  parseMessages,
  isNickValid,
  isRoomNameValid,
  isMessageTextValid,
  checkPasswordStrength,
  escapeSqlString,
  getMessageTypeName,
} from './shared/utils';

const PORT = parseInt(process.env.DEFAULT_PORT || '3001', 10);
const JWT_SECRET = process.env.JWT_SECRET || '';
const DB_PATH = process.env.DB_PATH || 'data/lanchat.db';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const DB_IMMEDIATE_SAVE = true; // 强制立即保存，确保数据不丢失
const DB_SAVE_INTERVAL = parseInt(process.env.DB_SAVE_INTERVAL || '30000', 10);
const USE_TLS = process.env.USE_TLS === 'true';
const TLS_CERT_PATH = process.env.TLS_CERT_PATH || 'certs/server.crt';
const TLS_KEY_PATH = process.env.TLS_KEY_PATH || 'certs/server.key';

const LOG_DIR = path.join(__dirname, '../logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, module }) => {
      return `${timestamp} [${level.toUpperCase()}] [${module || 'server'}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'server.log'),
      maxsize: 1024 * 1024 * 10,
      maxFiles: 5,
      tailable: true,
      format: winston.format.printf(({ timestamp, level, message, module }) => {
        return `${timestamp} [${level.toUpperCase()}] [${module || 'server'}] ${message}`;
      })
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 1024 * 1024 * 5,
      maxFiles: 3,
      tailable: true,
      format: winston.format.printf(({ timestamp, level, message, module, stack }) => {
        return `${timestamp} [${level.toUpperCase()}] [${module || 'server'}] ${message}${stack ? '\n' + stack : ''}`;
      })
    }),
    new winston.transports.Console({
      level: 'error',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, module, stack }) => {
          return `${timestamp} [${level.toUpperCase()}] [${module || 'server'}] ${message}${stack ? '\n' + stack : ''}`;
        })
      ),
    }),
  ],
});

let db: SqlDatabase;
let dbSaveTimer: NodeJS.Timeout | null = null;
let dbSaveInProgress = false;
const dbWriteQueue: Array<() => void> = [];

const revokedTokens = new Set<string>();
const tokenExpiryMap = new Map<string, number>();

function isTokenRevoked(token: string): boolean {
  return revokedTokens.has(token);
}

function revokeToken(token: string): void {
  revokedTokens.add(token);
  
  const expiry = tokenExpiryMap.get(token);
  if (expiry) {
    const delay = expiry - Date.now();
    if (delay > 0) {
      setTimeout(() => {
        revokedTokens.delete(token);
        tokenExpiryMap.delete(token);
      }, delay);
    }
  }
}

function setTokenExpiry(token: string, expiry: number): void {
  tokenExpiryMap.set(token, expiry);
}

async function initDatabase() {
  const SQL = await initSqlJs();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_by INTEGER REFERENCES users(id),
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER REFERENCES rooms(id) NOT NULL,
      sender_id INTEGER REFERENCES users(id) NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      timestamp TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS private_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER REFERENCES users(id) NOT NULL,
      receiver_id INTEGER REFERENCES users(id) NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_room_time ON messages (room_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_private_messages_users_time ON private_messages (sender_id, receiver_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_users_nickname ON users (nickname);
  `);

  const hasDefault = db.exec("SELECT id FROM rooms WHERE name = '#general'");
  if (hasDefault.length === 0 || hasDefault[0].values.length === 0) {
    db.run("INSERT INTO rooms (name, is_default) VALUES ('#general', 1)");
  }
}

function scheduleDatabaseSave() {
  if (dbSaveTimer) clearTimeout(dbSaveTimer);
  dbSaveTimer = setTimeout(flushDatabase, DB_SAVE_INTERVAL);
}

function flushDatabase() {
  if (dbSaveInProgress) {
    scheduleDatabaseSave();
    return;
  }

  dbSaveInProgress = true;
  try {
    while (dbWriteQueue.length > 0) {
      const task = dbWriteQueue.shift();
      if (task) task();
    }

    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    logger.debug('数据库已保存');
  } catch (err) {
    logger.error(`数据库保存失败: ${(err as Error).message}`);
  } finally {
    dbSaveInProgress = false;
    if (!DB_IMMEDIATE_SAVE) {
      scheduleDatabaseSave();
    }
  }
}

function queueDatabaseWrite(task: () => void) {
  dbWriteQueue.push(task);
  if (DB_IMMEDIATE_SAVE) {
    flushDatabase();
  }
}

function saveDatabase() {
  if (DB_IMMEDIATE_SAVE) {
    flushDatabase();
  } else {
    scheduleDatabaseSave();
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  (crypto as any).getRandomValues(salt);
  return await argon2id({
    password,
    salt,
    parallelism: 2,
    iterations: 5,
    memorySize: 65536,
    hashLength: 32,
    outputType: 'encoded',
  });
}

async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2Verify({ hash, password });
}

const connections = new Map<number, { socket: Socket; remoteAddress: string }>();
const userStates = new Map<number, UserState>();
const nicknameToSocketId = new Map<string, number>();
const roomMembers = new Map<string, Set<number>>();
let nextConnId = 1;

function broadcastToRoom(room: string, type: number, payload: object, excludeSocketId?: number) {
  const members = roomMembers.get(room);
  if (!members) return;
  const data = encodeMessage(type, payload);
  for (const sockId of members) {
    if (excludeSocketId && sockId === excludeSocketId) continue;
    const conn = connections.get(sockId);
    if (conn) conn.socket.write(data);
  }
}

function sendError(socket: Socket, code: string, message: string) {
  socket.write(encodeMessage(MessageType.ERROR_RESPONSE, { code, message }));
}

function getRow<T extends User | Room | Message | PrivateMessage>(stmt: string): T | undefined {
  const results = db.exec(stmt);
  if (results.length === 0 || results[0].values.length === 0) return undefined;
  const columns = results[0].columns as string[];
  const values = results[0].values[0];
  const row: Record<string, unknown> = {};
  columns.forEach((col: string, idx: number) => {
    row[col] = values[idx];
  });
  return row as unknown as T;
}

function getAll<T>(stmt: string): T[] {
  const results = db.exec(stmt);
  if (results.length === 0) return [];
  return results[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    (results[0].columns as string[]).forEach((col: string, idx: number) => {
      obj[col] = row[idx];
    });
    return obj as T;
  });
}

function getRoomOrCreate(name: string): { id: number; name: string } {
  const escapedName = escapeSqlString(name);
  let room = db.exec(`SELECT * FROM rooms WHERE name = '${escapedName}'`);
  if (room.length === 0 || room[0].values.length === 0) {
    db.run(`INSERT INTO rooms (name) VALUES ('${escapedName}')`);
    room = db.exec(`SELECT * FROM rooms WHERE name = '${escapedName}'`);
  }
  if (!roomMembers.has(name)) roomMembers.set(name, new Set());
  return { id: room[0].values[0][0] as number, name: room[0].values[0][1] as string };
}

class HeartbeatManager {
  private timers = new Map<number, {
    interval: NodeJS.Timeout;
    lastAck: number;
    ackTimer: NodeJS.Timeout | undefined;
  }>();

  start(socketId: number, socket: Socket) {
    const entry: {
      interval: NodeJS.Timeout;
      lastAck: number;
      ackTimer: NodeJS.Timeout | undefined;
    } = {
      interval: setInterval(() => {
        socket.write(encodeMessage(MessageType.HEARTBEAT_REQUEST));
        if (entry.ackTimer) clearTimeout(entry.ackTimer);
        entry.ackTimer = setTimeout(() => {
          logger.warn(`心跳超时: ${socketId}`);
          handleDisconnect(socketId, '心跳超时');
        }, 10000);
      }, 15000),
      lastAck: Date.now(),
      ackTimer: undefined,
    };
    this.timers.set(socketId, entry);
  }

  ack(socketId: number) {
    const entry = this.timers.get(socketId);
    if (entry) {
      entry.lastAck = Date.now();
      if (entry.ackTimer) {
        clearTimeout(entry.ackTimer);
        entry.ackTimer = undefined;
      }
    }
  }

  stop(socketId: number) {
    const entry = this.timers.get(socketId);
    if (entry) {
      clearInterval(entry.interval);
      if (entry.ackTimer) clearTimeout(entry.ackTimer);
      this.timers.delete(socketId);
    }
  }
}

const heartbeatManager = new HeartbeatManager();

function handleMessage(socket: Socket, socketId: number, type: number, payload: unknown) {
  const startTime = Date.now();
  try {
    const state = userStates.get(socketId);
    if (!state && type !== MessageType.LOGIN_REQUEST && type !== MessageType.REGISTER_REQUEST && type !== MessageType.TOKEN_LOGIN_REQUEST && type !== MessageType.HEARTBEAT_REQUEST) {
      sendError(socket, 'AUTH_FAILED', '请先登录');
      return;
    }

    switch (type) {
      case MessageType.LOGIN_REQUEST:
        handleLogin(socket, socketId, payload as LoginRequestPayload);
        break;
      case MessageType.REGISTER_REQUEST:
        handleRegister(socket, socketId, payload as RegisterRequestPayload);
        break;
      case MessageType.TOKEN_LOGIN_REQUEST:
        handleTokenLogin(socket, socketId, payload as TokenLoginRequestPayload);
        break;
      case MessageType.TOKEN_REFRESH_REQUEST:
        handleTokenRefresh(socket, payload as TokenRefreshRequestPayload);
        break;
      case MessageType.TOKEN_INVALIDATE_REQUEST:
        handleTokenInvalidate(socket, payload as TokenInvalidateRequestPayload);
        break;
      case MessageType.HEARTBEAT_REQUEST:
        socket.write(encodeMessage(MessageType.HEARTBEAT_ACK));
        break;
      case MessageType.HEARTBEAT_ACK:
        heartbeatManager.ack(socketId);
        break;
      case MessageType.DISCONNECT_REQUEST:
        handleDisconnect(socketId, (payload as { reason?: string })?.reason || '用户主动断开');
        break;
      case MessageType.ROOM_LIST_REQUEST:
        sendRoomList(socket);
        break;
      case MessageType.USER_LIST_REQUEST:
        sendUserList(socket, socketId);
        break;
      case MessageType.ROOM_JOIN_REQUEST:
        handleRoomJoin(socket, socketId, payload as RoomJoinRequestPayload);
        break;
      case MessageType.ROOM_LEAVE_REQUEST:
        handleRoomLeave(socket, socketId);
        break;
      case MessageType.NICK_CHANGE_REQUEST:
        handleNickChange(socket, socketId, payload as { newNickname: string });
        break;
      case MessageType.CHAT_ROOM_MESSAGE:
        handleChatRoom(socket, socketId, payload as ChatRoomMessagePayload);
        break;
      case MessageType.CHAT_PRIVATE_MESSAGE:
        handleChatPrivate(socket, socketId, payload as ChatPrivateMessagePayload);
        break;
      case MessageType.HISTORY_REQUEST:
        handleHistoryRequest(socket, socketId, payload as HistoryRequestPayload);
        break;
      case MessageType.PASSWORD_CHANGE_REQUEST:
        handlePasswordChange(socket, socketId, payload as PasswordChangeRequestPayload);
        break;
      default:
        sendError(socket, 'INVALID_MESSAGE', '未知消息类型');
    }
  } catch (err: any) {
    logger.error(`消息处理错误 (类型: ${type}): ${err.stack || err.message}`);
    sendError(socket, 'INTERNAL_ERROR', err.message || '服务器内部错误');
  } finally {
    const duration = Date.now() - startTime;
    if (duration > 100) {
      logger.debug(`消息处理耗时: ${duration}ms (类型: ${getMessageTypeName(type)})`);
    }
  }
}

async function handleLogin(socket: Socket, socketId: number, payload: LoginRequestPayload) {
  const { nickname, password } = payload;
  if (!nickname || !password) {
    socket.write(encodeMessage(MessageType.LOGIN_RESPONSE, { success: false, error: '参数不完整' } as LoginResponsePayload));
    return;
  }

  const user = getRow(`SELECT * FROM users WHERE nickname = '${escapeSqlString(nickname)}'`) as User | undefined;
  if (!user) {
    socket.write(encodeMessage(MessageType.LOGIN_RESPONSE, { success: false, error: '用户名或密码错误' } as LoginResponsePayload));
    return;
  }

  const valid = await verifyPassword(user.password_hash, password);
  if (!valid) {
    socket.write(encodeMessage(MessageType.LOGIN_RESPONSE, { success: false, error: '用户名或密码错误' } as LoginResponsePayload));
    return;
  }

  if (nicknameToSocketId.has(nickname)) {
    socket.write(encodeMessage(MessageType.LOGIN_RESPONSE, { success: false, error: '该昵称已在线' } as LoginResponsePayload));
    return;
  }

  const token = jwt.sign({ sub: user.id, nickname: user.nickname }, JWT_SECRET, { expiresIn: '24h', algorithm: 'HS256' });
  const expiry = Date.now() + 24 * 60 * 60 * 1000;
  setTokenExpiry(token, expiry);
  
  userStates.set(socketId, { userId: user.id, nickname: user.nickname, activeRoom: '#general' });
  nicknameToSocketId.set(user.nickname, socketId);
  if (!roomMembers.has('#general')) roomMembers.set('#general', new Set());
  roomMembers.get('#general')!.add(socketId);

  socket.write(encodeMessage(MessageType.LOGIN_RESPONSE, { success: true, token } as LoginResponsePayload));
  broadcastToRoom('#general', MessageType.SYSTEM_MESSAGE, { text: `${user.nickname} 加入了 ${'#general'}`, timestamp: new Date().toISOString() } as SystemMessagePayload, socketId);
  sendUserList(socket, socketId);
  sendHistory(socket, '#general', 50);
  heartbeatManager.start(socketId, socket);

  const conn = connections.get(socketId);
  logger.info(`${user.nickname} 登录成功 (IP: ${conn?.remoteAddress || 'unknown'})`);
  saveDatabase();
}

async function handleRegister(socket: Socket, socketId: number, payload: RegisterRequestPayload) {
  const { nickname, password } = payload;
  if (!nickname || !password) {
    socket.write(encodeMessage(MessageType.REGISTER_RESPONSE, { success: false, error: '参数不完整' } as RegisterResponsePayload));
    return;
  }

  if (!isNickValid(nickname)) {
    socket.write(encodeMessage(MessageType.REGISTER_RESPONSE, { success: false, error: '昵称格式不合法 (3-20位字母数字下划线，首字符字母)' } as RegisterResponsePayload));
    return;
  }

  const passwordResult = checkPasswordStrength(password);
  if (!passwordResult.valid) {
    socket.write(encodeMessage(MessageType.REGISTER_RESPONSE, { success: false, error: '密码不符合要求：' + passwordResult.errors.join('；') } as RegisterResponsePayload));
    return;
  }

  const exists = getRow(`SELECT id FROM users WHERE nickname = '${escapeSqlString(nickname)}'`);
  if (exists) {
    socket.write(encodeMessage(MessageType.REGISTER_RESPONSE, { success: false, error: '昵称已被占用' } as RegisterResponsePayload));
    return;
  }

  const hashed = await hashPassword(password);
  db.run(`INSERT INTO users (nickname, password_hash) VALUES ('${escapeSqlString(nickname)}', '${escapeSqlString(hashed)}')`);
  socket.write(encodeMessage(MessageType.REGISTER_RESPONSE, { success: true } as RegisterResponsePayload));

  logger.info(`新用户注册: ${nickname}`);
  saveDatabase();
}

async function handleTokenLogin(socket: Socket, socketId: number, payload: TokenLoginRequestPayload) {
  const { token } = payload;
  if (!token) {
    socket.write(encodeMessage(MessageType.TOKEN_LOGIN_RESPONSE, { success: false, error: 'Token 不能为空' } as TokenLoginResponsePayload));
    return;
  }

  if (isTokenRevoked(token)) {
    socket.write(encodeMessage(MessageType.TOKEN_LOGIN_RESPONSE, { success: false, error: 'Token 已被注销' } as TokenLoginResponsePayload));
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const payload = decoded as unknown as { sub: number; nickname: string; exp: number };
    
    const expiry = payload.exp ? payload.exp * 1000 : Date.now() + 24 * 60 * 60 * 1000;
    setTokenExpiry(token, expiry);
    
    if (!payload.nickname || typeof payload.sub !== 'number') {
      socket.write(encodeMessage(MessageType.TOKEN_LOGIN_RESPONSE, { success: false, error: 'Token 无效' } as TokenLoginResponsePayload));
      return;
    }
    
    if (nicknameToSocketId.has(payload.nickname)) {
      socket.write(encodeMessage(MessageType.TOKEN_LOGIN_RESPONSE, { success: false, error: '该昵称已在线' } as TokenLoginResponsePayload));
      return;
    }

    const user = getRow<User>(`SELECT * FROM users WHERE id = ${payload.sub}`);
    if (!user) {
      socket.write(encodeMessage(MessageType.TOKEN_LOGIN_RESPONSE, { success: false, error: '用户不存在' } as TokenLoginResponsePayload));
      return;
    }

    userStates.set(socketId, { userId: user.id, nickname: user.nickname, activeRoom: '#general' });
    nicknameToSocketId.set(user.nickname, socketId);
    if (!roomMembers.has('#general')) roomMembers.set('#general', new Set());
    roomMembers.get('#general')!.add(socketId);

    socket.write(encodeMessage(MessageType.TOKEN_LOGIN_RESPONSE, { success: true, nickname: user.nickname } as TokenLoginResponsePayload));
    broadcastToRoom('#general', MessageType.SYSTEM_MESSAGE, { text: `${user.nickname} 重新加入`, timestamp: new Date().toISOString() } as SystemMessagePayload, socketId);
    sendUserList(socket, socketId);
    sendHistory(socket, '#general', 50);
    heartbeatManager.start(socketId, socket);

    const conn = connections.get(socketId);
    logger.info(`${user.nickname} 通过 Token 登录成功 (IP: ${conn?.remoteAddress || 'unknown'})`);
  } catch (err) {
    socket.write(encodeMessage(MessageType.TOKEN_LOGIN_RESPONSE, { success: false, error: 'Token 无效或已过期' } as TokenLoginResponsePayload));
  }
}

function handleTokenRefresh(socket: Socket, payload: TokenRefreshRequestPayload) {
  const { token } = payload;
  if (!token) {
    socket.write(encodeMessage(MessageType.TOKEN_REFRESH_RESPONSE, { success: false, error: 'Token 不能为空' } as TokenRefreshResponsePayload));
    return;
  }

  if (isTokenRevoked(token)) {
    socket.write(encodeMessage(MessageType.TOKEN_REFRESH_RESPONSE, { success: false, error: 'Token 已被注销' } as TokenRefreshResponsePayload));
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as { sub: number; nickname: string; exp: number };
    
    const timeUntilExpiry = decoded.exp * 1000 - Date.now();
    if (timeUntilExpiry > 24 * 60 * 60 * 1000) {
      socket.write(encodeMessage(MessageType.TOKEN_REFRESH_RESPONSE, { success: false, error: 'Token 无需刷新' } as TokenRefreshResponsePayload));
      return;
    }

    const user = getRow<User>(`SELECT * FROM users WHERE id = ${decoded.sub}`);
    if (!user) {
      socket.write(encodeMessage(MessageType.TOKEN_REFRESH_RESPONSE, { success: false, error: '用户不存在' } as TokenRefreshResponsePayload));
      return;
    }

    revokeToken(token);

    const newToken = jwt.sign({ sub: user.id, nickname: user.nickname }, JWT_SECRET, { expiresIn: '24h', algorithm: 'HS256' });
    const newExpiry = Date.now() + 24 * 60 * 60 * 1000;
    setTokenExpiry(newToken, newExpiry);

    socket.write(encodeMessage(MessageType.TOKEN_REFRESH_RESPONSE, { success: true, newToken } as TokenRefreshResponsePayload));
    logger.info(`${user.nickname} 的 Token 已刷新`);
  } catch (err) {
    socket.write(encodeMessage(MessageType.TOKEN_REFRESH_RESPONSE, { success: false, error: 'Token 无效或已过期' } as TokenRefreshResponsePayload));
  }
}

function handleTokenInvalidate(socket: Socket, payload: TokenInvalidateRequestPayload) {
  const { token } = payload;
  if (!token) {
    socket.write(encodeMessage(MessageType.TOKEN_INVALIDATE_RESPONSE, { success: false, error: 'Token 不能为空' } as TokenInvalidateResponsePayload));
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as { sub: number; nickname: string };
    
    revokeToken(token);
    socket.write(encodeMessage(MessageType.TOKEN_INVALIDATE_RESPONSE, { success: true } as TokenInvalidateResponsePayload));
    
    const user = getRow<User>(`SELECT * FROM users WHERE id = ${decoded.sub}`);
    if (user) {
      logger.info(`${user.nickname} 的 Token 已注销`);
    }
  } catch (err) {
    socket.write(encodeMessage(MessageType.TOKEN_INVALIDATE_RESPONSE, { success: false, error: 'Token 无效' } as TokenInvalidateResponsePayload));
  }
}

async function handlePasswordChange(socket: Socket, socketId: number, payload: PasswordChangeRequestPayload) {
  const state = userStates.get(socketId);
  if (!state) return;

  const { oldPassword, newPassword } = payload;
  if (!oldPassword || !newPassword) {
    socket.write(encodeMessage(MessageType.PASSWORD_CHANGE_RESPONSE, { success: false, error: '参数不完整' } as PasswordChangeResponsePayload));
    return;
  }

  const passwordResult = checkPasswordStrength(newPassword);
  if (!passwordResult.valid) {
    socket.write(encodeMessage(MessageType.PASSWORD_CHANGE_RESPONSE, { success: false, error: '密码不符合要求：' + passwordResult.errors.join('；') } as PasswordChangeResponsePayload));
    return;
  }

  const user = getRow(`SELECT * FROM users WHERE id = ${state.userId}`) as User | undefined;
  if (!user) {
    socket.write(encodeMessage(MessageType.PASSWORD_CHANGE_RESPONSE, { success: false, error: '用户不存在' } as PasswordChangeResponsePayload));
    return;
  }

  const valid = await verifyPassword(user.password_hash, oldPassword);
  if (!valid) {
    socket.write(encodeMessage(MessageType.PASSWORD_CHANGE_RESPONSE, { success: false, error: '旧密码不正确' } as PasswordChangeResponsePayload));
    return;
  }

  const newHashed = await hashPassword(newPassword);
  db.run(`UPDATE users SET password_hash = '${escapeSqlString(newHashed)}' WHERE id = ${state.userId}`);
  socket.write(encodeMessage(MessageType.PASSWORD_CHANGE_RESPONSE, { success: true } as PasswordChangeResponsePayload));

  logger.info(`${state.nickname} 修改密码成功`);
  saveDatabase();
}

function sendRoomList(socket: Socket) {
  const rooms = getAll<Room>("SELECT * FROM rooms");
  const list: RoomInfo[] = rooms.map(r => ({
    id: r.id,
    name: r.name,
    memberCount: roomMembers.get(r.name)?.size || 0,
  }));
  socket.write(encodeMessage(MessageType.ROOM_LIST_RESPONSE, { rooms: list }));
}

function sendUserList(socket: Socket, socketId: number) {
  const state = userStates.get(socketId);
  if (!state) return;
  const members = roomMembers.get(state.activeRoom) || new Set();
  const users: string[] = [];
  for (const id of members) {
    const u = userStates.get(id);
    if (u) users.push(u.nickname);
  }
  socket.write(encodeMessage(MessageType.USER_LIST_RESPONSE, { room: state.activeRoom, users }));
}

function handleRoomJoin(socket: Socket, socketId: number, payload: RoomJoinRequestPayload) {
  const state = userStates.get(socketId);
  if (!state) return;

  const { roomName } = payload;
  if (!isRoomNameValid(roomName)) {
    sendError(socket, 'INVALID_MESSAGE', '房间名格式不合法');
    return;
  }

  if (state.activeRoom !== '#general') {
    roomMembers.get(state.activeRoom)?.delete(socketId);
    broadcastToRoom(state.activeRoom, MessageType.SYSTEM_MESSAGE, { text: `${state.nickname} 离开了 ${state.activeRoom}`, timestamp: new Date().toISOString() } as SystemMessagePayload);
  }

  getRoomOrCreate(roomName);
  roomMembers.get(roomName)!.add(socketId);
  state.activeRoom = roomName;

  socket.write(encodeMessage(MessageType.ROOM_JOIN_RESPONSE, { room: roomName, success: true } as RoomJoinResponsePayload));
  broadcastToRoom(roomName, MessageType.SYSTEM_MESSAGE, { text: `${state.nickname} 加入了 ${roomName}`, timestamp: new Date().toISOString() } as SystemMessagePayload, socketId);
  sendUserList(socket, socketId);
  sendHistory(socket, roomName, 50);
}

function handleRoomLeave(socket: Socket, socketId: number) {
  const state = userStates.get(socketId);
  if (!state || state.activeRoom === '#general') {
    sendError(socket, 'INVALID_MESSAGE', '不能离开默认房间');
    return;
  }

  const oldRoom = state.activeRoom;
  roomMembers.get(oldRoom)?.delete(socketId);
  broadcastToRoom(oldRoom, MessageType.SYSTEM_MESSAGE, { text: `${state.nickname} 离开了 ${oldRoom}`, timestamp: new Date().toISOString() } as SystemMessagePayload);

  state.activeRoom = '#general';
  if (!roomMembers.has('#general')) roomMembers.set('#general', new Set());
  roomMembers.get('#general')!.add(socketId);

  socket.write(encodeMessage(MessageType.SYSTEM_MESSAGE, { text: `你已离开 ${oldRoom}，返回 #general`, timestamp: new Date().toISOString() } as SystemMessagePayload));
  broadcastToRoom('#general', MessageType.SYSTEM_MESSAGE, { text: `${state.nickname} 加入了 #general`, timestamp: new Date().toISOString() } as SystemMessagePayload, socketId);
  sendUserList(socket, socketId);
}

function handleNickChange(socket: Socket, socketId: number, payload: { newNickname: string }) {
  const state = userStates.get(socketId);
  if (!state) return;

  const { newNickname } = payload;
  if (!isNickValid(newNickname)) {
    socket.write(encodeMessage(MessageType.NICK_CHANGE_RESPONSE, { success: false, error: '昵称格式不合法' }));
    return;
  }

  if (nicknameToSocketId.has(newNickname)) {
    socket.write(encodeMessage(MessageType.NICK_CHANGE_RESPONSE, { success: false, error: '昵称已被占用' }));
    return;
  }

  const oldNick = state.nickname;
  nicknameToSocketId.delete(oldNick);
  state.nickname = newNickname;
  nicknameToSocketId.set(newNickname, socketId);

  db.run(`UPDATE users SET nickname = '${escapeSqlString(newNickname)}' WHERE id = ${state.userId}`);
  socket.write(encodeMessage(MessageType.NICK_CHANGE_RESPONSE, { success: true, newNickname }));
  broadcastToRoom(state.activeRoom, MessageType.SYSTEM_MESSAGE, { text: `${oldNick} 改名为 ${newNickname}`, timestamp: new Date().toISOString() } as SystemMessagePayload);

  logger.info(`${oldNick} 改名为 ${newNickname}`);
  saveDatabase();
}

function handleChatRoom(socket: Socket, socketId: number, payload: ChatRoomMessagePayload) {
  const state = userStates.get(socketId);
  if (!state) return;

  const { text } = payload;
  if (!isMessageTextValid(text)) {
    sendError(socket, 'INVALID_MESSAGE', '消息内容不合法');
    return;
  }

  const room = getRoomOrCreate(state.activeRoom);
  db.run(`INSERT INTO messages (room_id, sender_id, content, type) VALUES (${room.id}, ${state.userId}, '${escapeSqlString(text)}', 'text')`);

  const timestamp = new Date().toISOString();
  broadcastToRoom(state.activeRoom, MessageType.CHAT_ROOM_MESSAGE, {
    room: state.activeRoom,
    text,
    timestamp,
    sender: state.nickname,
  } as ChatRoomMessagePayload, socketId);

  saveDatabase();
}

function handleChatPrivate(socket: Socket, socketId: number, payload: ChatPrivateMessagePayload) {
  const state = userStates.get(socketId);
  if (!state) return;

  const { target, text } = payload;
  if (!target || !isMessageTextValid(text)) {
    sendError(socket, 'INVALID_MESSAGE', '消息内容或目标不合法');
    return;
  }

  const targetSocketId = nicknameToSocketId.get(target);
  if (!targetSocketId) {
    sendError(socket, 'TARGET_OFFLINE', '目标用户不在线');
    return;
  }

  const targetState = userStates.get(targetSocketId);
  if (!targetState) {
    sendError(socket, 'TARGET_OFFLINE', '目标用户不在线');
    return;
  }

  const senderUser = getRow(`SELECT id FROM users WHERE nickname = '${escapeSqlString(state.nickname)}'`) as User | undefined;
  const receiverUser = getRow(`SELECT id FROM users WHERE nickname = '${escapeSqlString(target)}'`) as User | undefined;

  if (senderUser && receiverUser) {
    db.run(`INSERT INTO private_messages (sender_id, receiver_id, content) VALUES (${senderUser.id}, ${receiverUser.id}, '${escapeSqlString(text)}')`);
  }

  const timestamp = new Date().toISOString();
  const targetConn = connections.get(targetSocketId);
  targetConn?.socket.write(encodeMessage(MessageType.CHAT_PRIVATE_MESSAGE, {
    target: targetState.nickname,
    text,
    timestamp,
    sender: state.nickname,
  } as ChatPrivateMessagePayload));

  socket.write(encodeMessage(MessageType.CHAT_PRIVATE_MESSAGE, {
    target: targetState.nickname,
    text,
    timestamp,
    sender: state.nickname,
  } as ChatPrivateMessagePayload));

  saveDatabase();
}

function handleHistoryRequest(socket: Socket, socketId: number, payload: HistoryRequestPayload) {
  const state = userStates.get(socketId);
  if (!state) return;

  const { type, room, target, count = 50 } = payload;
  const messages: HistoryMessage[] = [];

  if (type === 'room') {
    const roomName = room || state.activeRoom;
    const roomData = getRow(`SELECT id FROM rooms WHERE name = '${escapeSqlString(roomName)}'`) as Room | undefined;
    
    if (!roomData) {
      sendError(socket, 'ROOM_NOT_FOUND', '房间不存在');
      return;
    }

    const rows = getAll<Message>(`SELECT * FROM messages WHERE room_id = ${roomData.id} ORDER BY timestamp DESC LIMIT ${count}`);
    messages.push(...rows.reverse().map(r => {
      const sender = getRow(`SELECT nickname FROM users WHERE id = ${r.sender_id}`) as User | undefined;
      return { sender: sender ? sender.nickname : 'unknown', content: r.content, timestamp: r.timestamp };
    }));
  } else if (type === 'private' && target) {
    const targetUser = getRow(`SELECT id FROM users WHERE nickname = '${escapeSqlString(target)}'`) as User | undefined;
    
    if (!targetUser) {
      sendError(socket, 'USER_NOT_FOUND', '目标用户不存在');
      return;
    }

    const rows = getAll<PrivateMessage>(`
      SELECT * FROM private_messages 
      WHERE (sender_id = ${state.userId} AND receiver_id = ${targetUser.id}) 
         OR (sender_id = ${targetUser.id} AND receiver_id = ${state.userId})
      ORDER BY timestamp DESC LIMIT ${count}
    `);

    messages.push(...rows.reverse().map(r => {
      const sender = getRow(`SELECT nickname FROM users WHERE id = ${r.sender_id}`) as User | undefined;
      return { sender: sender ? sender.nickname : 'unknown', content: r.content, timestamp: r.timestamp };
    }));
  } else {
    sendError(socket, 'INVALID_MESSAGE', '无效的历史查询参数');
    return;
  }

  socket.write(encodeMessage(MessageType.HISTORY_RESPONSE, { messages } as HistoryResponsePayload));
}

function sendHistory(socket: Socket, roomName: string, count: number) {
  const room = getRow(`SELECT id FROM rooms WHERE name = '${escapeSqlString(roomName)}'`) as Room | undefined;
  if (!room) return;

  const rows = getAll<Message>(`SELECT * FROM messages WHERE room_id = ${room.id} ORDER BY timestamp DESC LIMIT ${count}`);
  const messages: HistoryMessage[] = rows.reverse().map(r => {
    const sender = getRow(`SELECT nickname FROM users WHERE id = ${r.sender_id}`) as User | undefined;
    return { sender: sender ? sender.nickname : 'unknown', content: r.content, timestamp: r.timestamp };
  });

  if (messages.length > 0) {
    socket.write(encodeMessage(MessageType.HISTORY_RESPONSE, { messages } as HistoryResponsePayload));
  }
}

function handleDisconnect(socketId: number, reason: string) {
  const conn = connections.get(socketId);
  if (!conn) return;

  heartbeatManager.stop(socketId);

  const state = userStates.get(socketId);
  if (state) {
    for (const [room, members] of roomMembers.entries()) {
      if (members.has(socketId)) {
        members.delete(socketId);
        broadcastToRoom(room, MessageType.SYSTEM_MESSAGE, { text: `${state.nickname} 离开了 ${room}`, timestamp: new Date().toISOString() } as SystemMessagePayload);
      }
    }
    nicknameToSocketId.delete(state.nickname);
    userStates.delete(socketId);
    logger.info(`${state.nickname} 断开连接: ${reason} (IP: ${conn.remoteAddress})`);
  }

  connections.delete(socketId);
  conn.socket.destroy();
}

function generateSelfSignedCertificate(): { cert: string; key: string } {
  const privateKey = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const cert = `-----BEGIN CERTIFICATE-----
${Buffer.from(crypto.createHash('sha256').update(privateKey.publicKey).digest('base64')).toString()}
-----END CERTIFICATE-----`;

  return { cert, key: privateKey.privateKey };
}

async function start() {
  if (JWT_SECRET.length < 32) {
    logger.error('JWT_SECRET 长度不足32位，请设置至少32位的密钥');
    process.exit(1);
  }

  await initDatabase();

  let server: Server;

  if (USE_TLS) {
    const certDir = path.dirname(TLS_CERT_PATH);
    if (!fs.existsSync(certDir)) fs.mkdirSync(certDir, { recursive: true });

    let cert: string;
    let key: string;

    if (fs.existsSync(TLS_CERT_PATH) && fs.existsSync(TLS_KEY_PATH)) {
      cert = fs.readFileSync(TLS_CERT_PATH, 'utf-8');
      key = fs.readFileSync(TLS_KEY_PATH, 'utf-8');
    } else {
      logger.info('未找到 TLS 证书，自动生成自签名证书');
      const generated = generateSelfSignedCertificate();
      cert = generated.cert;
      key = generated.key;
      fs.writeFileSync(TLS_CERT_PATH, cert);
      fs.writeFileSync(TLS_KEY_PATH, key);
    }

    server = tls.createServer({ cert, key }, (socket: tls.TLSSocket) => {
      handleConnection(socket);
    });
  } else {
    server = createServer((socket: Socket) => {
      handleConnection(socket);
    });
  }

  server.listen(PORT, () => {
    logger.info(`服务器启动，监听端口 ${PORT} (${USE_TLS ? 'TLS' : 'TCP'})`);
  });

  server.on('error', (err: Error) => {
    logger.error(`服务器错误: ${err.message}`);
    process.exit(1);
  });
}

function handleConnection(socket: Socket) {
  const socketId = nextConnId++;
  connections.set(socketId, { socket, remoteAddress: socket.remoteAddress || 'unknown' });
  let recvBuffer: Buffer = Buffer.alloc(0);

  logger.info(`新连接: ${socketId} (IP: ${socket.remoteAddress})`);

  socket.on('data', (data: Buffer) => {
    recvBuffer = Buffer.concat([recvBuffer, data]);
    const { messages, remaining } = parseMessages(recvBuffer);
    recvBuffer = remaining;
    for (const msg of messages) {
      handleMessage(socket, socketId, msg.type, msg.payload);
    }
  });

  socket.on('close', () => {
    handleDisconnect(socketId, '连接关闭');
  });

  socket.on('error', (err: Error) => {
    logger.error(`Socket ${socketId} 错误: ${err.message}`);
    handleDisconnect(socketId, '连接错误');
  });
}

process.on('SIGINT', () => {
  logger.info('收到 SIGINT 信号，正在保存数据库...');
  flushDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM 信号，正在保存数据库...');
  flushDatabase();
  process.exit(0);
});

process.on('uncaughtException', (err: Error) => {
  logger.error('未捕获异常:', err.stack || err.message);
  flushDatabase();
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('未处理的Promise拒绝:', reason);
});

start();