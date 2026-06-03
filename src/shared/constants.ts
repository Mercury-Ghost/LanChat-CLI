import * as crypto from 'crypto';

/**
 * 服务器监听端口
 */
export const SERVER_PORT = parseInt(process.env.PORT || '9527', 10);

/**
 * JWT 密钥
 * 通过环境变量 JWT_SECRET 设置，生产环境必须设置，开发环境自动生成随机密钥
 */
const isProduction = process.env.NODE_ENV === 'production';
const jwtSecretFromEnv = process.env.JWT_SECRET;

if (jwtSecretFromEnv && jwtSecretFromEnv.length < 32) {
  console.warn('警告: JWT_SECRET 建议至少 32 个字符以获得更高安全性。');
}

function generateRandomSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

let jwtSecret: string;

if (jwtSecretFromEnv) {
  jwtSecret = jwtSecretFromEnv;
} else if (isProduction) {
  throw new Error('生产环境必须设置 JWT_SECRET 环境变量。请设置一个强密钥（至少 32 个字符）。');
} else {
  const generatedSecret = generateRandomSecret();
  console.warn('⚠️  开发环境：使用自动生成的临时密钥，生产环境请设置 JWT_SECRET 环境变量');
  jwtSecret = generatedSecret;
}

export const JWT_SECRET = jwtSecret;

/**
 * JWT 令牌过期时间（秒），默认 24 小时
 */
export const JWT_EXPIRES_IN = parseInt(process.env.JWT_EXPIRES_IN || (24 * 60 * 60).toString(), 10);

/**
 * 数据库文件路径
 */
export const DB_PATH = process.env.DB_PATH || 'data/lanchat.db';

/**
 * 文件存储目录
 */
export const FILES_DIR = process.env.FILES_DIR || 'data/files';

/**
 * TLS 证书路径
 */
export const CERT_PATH = process.env.CERT_PATH || 'certs/server.crt';

/**
 * TLS 私钥路径
 */
export const KEY_PATH = process.env.KEY_PATH || 'certs/server.key';

/**
 * 日志级别
 */
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

/**
 * 默认主机地址
 */
export const DEFAULT_HOST = process.env.DEFAULT_HOST || '127.0.0.1';

/**
 * 默认端口
 */
export const DEFAULT_PORT = parseInt(process.env.DEFAULT_PORT || '9527', 10);

/**
 * Argon2 密码哈希算法时间成本
 */
export const ARGON2_TIME_COST = parseInt(process.env.ARGON2_TIME_COST || '4', 10);

/**
 * Argon2 密码哈希算法内存成本（KB）
 */
export const ARGON2_MEMORY_COST = parseInt(process.env.ARGON2_MEMORY_COST || '65536', 10);

/**
 * Argon2 密码哈希算法并行度
 */
export const ARGON2_PARALLELISM = parseInt(process.env.ARGON2_PARALLELISM || '2', 10);

/**
 * Argon2 哈希输出长度（字节）
 */
export const ARGON2_HASH_LENGTH = 32;

/**
 * 心跳发送间隔（毫秒）
 */
export const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || '15000', 10);

/**
 * 心跳超时时间（毫秒）
 */
export const HEARTBEAT_TIMEOUT = parseInt(process.env.HEARTBEAT_TIMEOUT || '10000', 10);

/**
 * 连接超时时间（毫秒）
 */
export const CONNECTION_TIMEOUT = parseInt(process.env.CONNECTION_TIMEOUT || '30000', 10);

/**
 * 最大文件传输大小（字节），默认 500MB
 */
export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '524288000', 10);

/**
 * 文件传输块大小（字节），默认 64KB
 */
export const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '65536', 10);

/**
 * 文件传输进度更新间隔（毫秒）
 */
export const PROGRESS_UPDATE_INTERVAL = parseInt(process.env.PROGRESS_UPDATE_INTERVAL || '1000', 10);

/**
 * 每传输多少个块更新一次进度
 */
export const PROGRESS_UPDATE_CHUNKS = parseInt(process.env.PROGRESS_UPDATE_CHUNKS || '10', 10);

/**
 * 临时文件保留时间（小时）
 */
export const TEMP_FILE_RETENTION_HOURS = parseInt(process.env.TEMP_FILE_RETENTION_HOURS || '24', 10);

/**
 * 昵称最小长度
 */
export const MIN_NICKNAME_LENGTH = 3;

/**
 * 昵称最大长度
 */
export const MAX_NICKNAME_LENGTH = 20;

/**
 * 房间名最小长度
 */
export const MIN_ROOMNAME_LENGTH = 1;

/**
 * 房间名最大长度
 */
export const MAX_ROOMNAME_LENGTH = 30;

/**
 * 消息最大长度
 */
export const MAX_MESSAGE_LENGTH = 5000;

/**
 * 历史消息最大数量
 */
export const MAX_HISTORY_COUNT = 200;

/**
 * 默认历史消息数量
 */
export const DEFAULT_HISTORY_COUNT = 50;

/**
 * 默认房间名称
 */
export const DEFAULT_ROOM_NAME = '#general';

/**
 * 最大并发连接数
 */
export const MAX_CONNECTIONS = parseInt(process.env.MAX_CONNECTIONS || '100', 10);

/**
 * 单个用户最大并发文件传输数
 */
export const MAX_USER_TRANSFERS = parseInt(process.env.MAX_USER_TRANSFERS || '3', 10);

/**
 * 全局最大并发文件传输数
 */
export const MAX_GLOBAL_TRANSFERS = parseInt(process.env.MAX_GLOBAL_TRANSFERS || '20', 10);
