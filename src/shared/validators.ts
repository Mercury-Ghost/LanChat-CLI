import {
  MIN_NICKNAME_LENGTH,
  MAX_NICKNAME_LENGTH,
  MIN_ROOMNAME_LENGTH,
  MAX_ROOMNAME_LENGTH,
  MAX_MESSAGE_LENGTH,
} from './constants';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const NICKNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const ROOMNAME_REGEX = /^[a-zA-Z0-9_-]*$/;

export function validateNickname(nickname: string): ValidationResult {
  if (!nickname || typeof nickname !== 'string') {
    return { valid: false, error: '昵称不能为空' };
  }

  if (nickname.length < MIN_NICKNAME_LENGTH) {
    return { valid: false, error: `昵称长度不能少于 ${MIN_NICKNAME_LENGTH} 个字符` };
  }

  if (nickname.length > MAX_NICKNAME_LENGTH) {
    return { valid: false, error: `昵称长度不能超过 ${MAX_NICKNAME_LENGTH} 个字符` };
  }

  if (!NICKNAME_REGEX.test(nickname)) {
    return { valid: false, error: '昵称只能包含字母、数字和下划线，且首字符必须为字母' };
  }

  return { valid: true };
}

export function validateRoomName(roomName: string): ValidationResult {
  if (!roomName || typeof roomName !== 'string') {
    return { valid: false, error: '房间名不能为空' };
  }

  if (!roomName.startsWith('#')) {
    return { valid: false, error: '房间名必须以 # 开头' };
  }

  const nameWithoutHash = roomName.slice(1);

  if (nameWithoutHash.length < MIN_ROOMNAME_LENGTH) {
    return { valid: false, error: `房间名长度不能少于 ${MIN_ROOMNAME_LENGTH} 个字符` };
  }

  if (nameWithoutHash.length > MAX_ROOMNAME_LENGTH) {
    return { valid: false, error: `房间名长度不能超过 ${MAX_ROOMNAME_LENGTH} 个字符` };
  }

  if (!ROOMNAME_REGEX.test(nameWithoutHash)) {
    return { valid: false, error: '房间名只能包含字母、数字、连字符和下划线' };
  }

  return { valid: true };
}

export function validateMessage(text: string): ValidationResult {
  if (!text || typeof text !== 'string') {
    return { valid: false, error: '消息内容不能为空' };
  }

  if (text.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `消息长度不能超过 ${MAX_MESSAGE_LENGTH} 个字符` };
  }

  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: '密码不能为空' };
  }

  if (password.length < 6) {
    return { valid: false, error: '密码长度不能少于 6 个字符' };
  }

  return { valid: true };
}

export function validateFileSize(size: number, maxSize: number): ValidationResult {
  if (size <= 0) {
    return { valid: false, error: '文件大小必须大于 0' };
  }

  if (size > maxSize) {
    return { valid: false, error: `文件大小不能超过 ${Math.round(maxSize / 1024 / 1024)} MB` };
  }

  return { valid: true };
}
