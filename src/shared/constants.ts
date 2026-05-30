export const SERVER_PORT = parseInt(process.env.PORT || '9527', 10);

const DEFAULT_JWT_SECRET = 'default_secret_change_in_production';
export const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
export const JWT_EXPIRES_IN = 24 * 60 * 60;

export function isUsingDefaultJwtSecret(): boolean {
  return JWT_SECRET === DEFAULT_JWT_SECRET;
}

export const DB_PATH = process.env.DB_PATH || 'data/lanchat.db';
export const FILES_DIR = process.env.FILES_DIR || 'data/files';
export const CERT_PATH = process.env.CERT_PATH || 'certs/server.crt';
export const KEY_PATH = process.env.KEY_PATH || 'certs/server.key';

export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export const DEFAULT_HOST = process.env.DEFAULT_HOST || '127.0.0.1';
export const DEFAULT_PORT = parseInt(process.env.DEFAULT_PORT || '9527', 10);

export const ARGON2_TIME_COST = parseInt(process.env.ARGON2_TIME_COST || '4', 10);
export const ARGON2_MEMORY_COST = parseInt(process.env.ARGON2_MEMORY_COST || '65536', 10);
export const ARGON2_PARALLELISM = parseInt(process.env.ARGON2_PARALLELISM || '2', 10);
export const ARGON2_HASH_LENGTH = 32;

export const HEARTBEAT_INTERVAL = parseInt(process.env.HEARTBEAT_INTERVAL || '15000', 10);
export const HEARTBEAT_TIMEOUT = parseInt(process.env.HEARTBEAT_TIMEOUT || '10000', 10);
export const CONNECTION_TIMEOUT = parseInt(process.env.CONNECTION_TIMEOUT || '30000', 10);

export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '524288000', 10);
export const CHUNK_SIZE = parseInt(process.env.CHUNK_SIZE || '65536', 10);
export const PROGRESS_UPDATE_INTERVAL = parseInt(process.env.PROGRESS_UPDATE_INTERVAL || '1000', 10);
export const PROGRESS_UPDATE_CHUNKS = parseInt(process.env.PROGRESS_UPDATE_CHUNKS || '10', 10);
export const TEMP_FILE_RETENTION_HOURS = parseInt(process.env.TEMP_FILE_RETENTION_HOURS || '24', 10);

export const MIN_NICKNAME_LENGTH = 3;
export const MAX_NICKNAME_LENGTH = 20;
export const MIN_ROOMNAME_LENGTH = 1;
export const MAX_ROOMNAME_LENGTH = 30;
export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_HISTORY_COUNT = 200;
export const DEFAULT_HISTORY_COUNT = 50;

export const DEFAULT_ROOM_NAME = '#general';
