import { MessageType, MessageParseResult, ParsedMessage } from './types';

/**
 * 编码消息为二进制格式
 * @param type 消息类型
 * @param payload 消息负载（可选）
 * @returns 编码后的 Buffer
 */
export function encodeMessage(type: number, payload?: object): Buffer {
  const payloadBuffer = payload ? Buffer.from(JSON.stringify(payload), 'utf-8') : Buffer.alloc(0);
  const totalLength = 5 + payloadBuffer.length;
  const header = Buffer.alloc(5);
  header.writeUInt32BE(totalLength, 0);
  header.writeUInt8(type, 4);
  return Buffer.concat([header, payloadBuffer]);
}

/**
 * 解析缓冲区中的消息
 * @param buffer 输入缓冲区
 * @returns 解析结果，包含完整消息数组和剩余未解析数据
 */
export function parseMessages(buffer: Buffer): MessageParseResult {
  const messages: ParsedMessage[] = [];
  let offset = 0;
  
  while (offset + 5 <= buffer.length) {
    const totalLength = buffer.readUInt32BE(offset);
    
    if (buffer.length < offset + totalLength) {
      break;
    }
    
    const type = buffer.readUInt8(offset + 4);
    const payloadLength = totalLength - 5;
    let payload: unknown = null;
    
    if (payloadLength > 0) {
      try {
        payload = JSON.parse(buffer.subarray(offset + 5, offset + totalLength).toString('utf-8'));
      } catch {
        payload = null;
      }
    }
    
    messages.push({ type, payload });
    offset += totalLength;
  }
  
  return { messages, remaining: buffer.subarray(offset) };
}

/**
 * 验证昵称格式
 * @param nick 昵称
 * @returns 是否有效
 */
export function isNickValid(nick: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/.test(nick);
}

/**
 * 验证房间名格式
 * @param name 房间名
 * @returns 是否有效
 */
export function isRoomNameValid(name: string): boolean {
  return /^#[a-zA-Z0-9_-]{1,30}$/.test(name);
}

/**
 * 验证消息文本
 * @param text 消息文本
 * @returns 是否有效
 */
export function isMessageTextValid(text: string): boolean {
  return text.length > 0 && text.length <= 5000;
}

/**
 * 密码强度检查结果
 */
export interface PasswordStrengthResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

/**
 * 验证密码强度
 * @param password 密码
 * @param requireSpecialChar 是否要求特殊字符（默认false）
 * @returns 密码强度检查结果
 */
export function checkPasswordStrength(password: string, requireSpecialChar: boolean = false): PasswordStrengthResult {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('密码长度至少为8个字符');
  }
  if (password.length > 20) {
    errors.push('密码长度不能超过20个字符');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('密码必须包含小写字母');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('密码必须包含大写字母');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('密码必须包含数字');
  }
  if (requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('密码必须包含特殊字符');
  }
  
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (errors.length === 0) {
    if (password.length >= 12) {
      strength = 'strong';
    } else {
      strength = 'medium';
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * 转义 SQL 字符串中的单引号
 * @param str 输入字符串
 * @returns 转义后的字符串
 */
export function escapeSqlString(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * 生成随机字符串
 * @param length 长度
 * @returns 随机字符串
 */
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

/**
 * 格式化时间戳为可读格式
 * @param timestamp ISO 时间戳
 * @returns 格式化的时间字符串
 */
export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

/**
 * 获取消息类型名称
 * @param type 消息类型编号
 * @returns 消息类型名称
 */
export function getMessageTypeName(type: number): string {
  return MessageType[type] || `UNKNOWN_0x${type.toString(16).padStart(2, '0')}`;
}