import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface Config {
    serverPort: number;
    defaultHost: string;
    defaultPort: number;
    jwtSecret: string;
    jwtExpiresIn: number;
    dbPath: string;
    filesDir: string;
    certPath: string;
    keyPath: string;
    logLevel: string;
    heartbeatInterval: number;
    heartbeatTimeout: number;
    connectionTimeout: number;
    maxFileSize: number;
    chunkSize: number;
    argon2TimeCost: number;
    argon2MemoryCost: number;
    argon2Parallelism: number;
    minNicknameLength: number;
    maxNicknameLength: number;
    maxMessageLength: number;
    maxHistoryCount: number;
    defaultHistoryCount: number;
    defaultRoomName: string;
}

const defaultConfig: Config = {
  serverPort: 9527,
  defaultHost: '127.0.0.1',
  defaultPort: 9527,
  jwtSecret: '',
  jwtExpiresIn: 86400,
  dbPath: './data/lanchat.db',
  filesDir: './files',
  certPath: './certs/server.crt',
  keyPath: './certs/server.key',
  logLevel: 'info',
  heartbeatInterval: 15000,
  heartbeatTimeout: 10000,
  connectionTimeout: 30000,
  maxFileSize: 524288000,
  chunkSize: 65536,
  argon2TimeCost: 4,
  argon2MemoryCost: 65536,
  argon2Parallelism: 2,
  minNicknameLength: 3,
  maxNicknameLength: 20,
  maxMessageLength: 5000,
  maxHistoryCount: 200,
  defaultHistoryCount: 50,
  defaultRoomName: '#general'
};

let config: Config | null = null;

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function validateConfig(loadedConfig: Config): void {
  if (isProduction() && !loadedConfig.jwtSecret) {
    throw new Error(
      '生产环境必须设置 JWT_SECRET 环境变量。' +
            '请设置一个强密钥（至少 32 个字符）。'
    );
  }
  if (loadedConfig.jwtSecret && loadedConfig.jwtSecret.length < 32) {
    console.warn(
      '警告: JWT_SECRET 建议至少 32 个字符以获得更高安全性。'
    );
  }
}

export function loadConfig(envPath?: string): Config {
  if (config) {
    return config;
  }

  if (envPath && fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else {
    const defaultEnvPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(defaultEnvPath)) {
      dotenv.config({ path: defaultEnvPath });
    }
  }

  const jwtSecretFromEnv = getString('JWT_SECRET', '');
    
  config = {
    serverPort: getNumberWithFallback(['PORT', 'SERVER_PORT'], defaultConfig.serverPort),
    defaultHost: getString('DEFAULT_HOST', defaultConfig.defaultHost),
    defaultPort: getNumberWithFallback(['DEFAULT_PORT'], defaultConfig.defaultPort),
    jwtSecret: jwtSecretFromEnv || (isProduction() ? '' : getDefaultTestJwtSecret()),
    jwtExpiresIn: getNumberWithFallback(['JWT_EXPIRES_IN'], defaultConfig.jwtExpiresIn),
    dbPath: getString('DB_PATH', defaultConfig.dbPath),
    filesDir: getString('FILES_DIR', defaultConfig.filesDir),
    certPath: getString('CERT_PATH', defaultConfig.certPath),
    keyPath: getString('KEY_PATH', defaultConfig.keyPath),
    logLevel: getString('LOG_LEVEL', defaultConfig.logLevel),
    heartbeatInterval: getNumberWithFallback(['HEARTBEAT_INTERVAL'], defaultConfig.heartbeatInterval),
    heartbeatTimeout: getNumberWithFallback(['HEARTBEAT_TIMEOUT'], defaultConfig.heartbeatTimeout),
    connectionTimeout: getNumberWithFallback(['CONNECTION_TIMEOUT'], defaultConfig.connectionTimeout),
    maxFileSize: getNumberWithFallback(['MAX_FILE_SIZE'], defaultConfig.maxFileSize),
    chunkSize: getNumberWithFallback(['CHUNK_SIZE'], defaultConfig.chunkSize),
    argon2TimeCost: getNumberWithFallback(['ARGON2_TIME_COST'], defaultConfig.argon2TimeCost),
    argon2MemoryCost: getNumberWithFallback(['ARGON2_MEMORY_COST'], defaultConfig.argon2MemoryCost),
    argon2Parallelism: getNumberWithFallback(['ARGON2_PARALLELISM'], defaultConfig.argon2Parallelism),
    minNicknameLength: getNumberWithFallback(['MIN_NICKNAME_LENGTH'], defaultConfig.minNicknameLength),
    maxNicknameLength: getNumberWithFallback(['MAX_NICKNAME_LENGTH'], defaultConfig.maxNicknameLength),
    maxMessageLength: getNumberWithFallback(['MAX_MESSAGE_LENGTH'], defaultConfig.maxMessageLength),
    maxHistoryCount: getNumberWithFallback(['MAX_HISTORY_COUNT'], defaultConfig.maxHistoryCount),
    defaultHistoryCount: getNumberWithFallback(['DEFAULT_HISTORY_COUNT'], defaultConfig.defaultHistoryCount),
    defaultRoomName: getString('DEFAULT_ROOM_NAME', defaultConfig.defaultRoomName)
  };

  validateConfig(config);

  return config;
}

function getDefaultTestJwtSecret(): string {
  const secret = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️  开发环境：使用自动生成的临时密钥，生产环境请设置 JWT_SECRET 环境变量');
  return secret;
}

function getString(envVar: string, defaultValue: string): string {
  return process.env[envVar] ?? defaultValue;
}

function getNumberWithFallback(envVars: string[], defaultValue: number): number {
  for (const envVar of envVars) {
    const value = process.env[envVar];
    if (value !== undefined) {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return defaultValue;
}

export function getConfig(): Config {
  if (!config) {
    return loadConfig();
  }
  return config;
}

export function getServerPort(): number {
  return getConfig().serverPort;
}

export function getDbPath(): string {
  return getConfig().dbPath;
}

export function getFilesDir(): string {
  return getConfig().filesDir;
}

export function getCertPath(): string {
  return getConfig().certPath;
}

export function getKeyPath(): string {
  return getConfig().keyPath;
}

export function getJwtSecret(): string {
  return getConfig().jwtSecret;
}

export function getDefaultHost(): string {
  return getConfig().defaultHost;
}

export function getDefaultPort(): number {
  return getConfig().defaultPort;
}

export function getJwtExpiresIn(): number {
  return getConfig().jwtExpiresIn;
}

export function isDevEnvironment(): boolean {
  return !isProduction();
}
