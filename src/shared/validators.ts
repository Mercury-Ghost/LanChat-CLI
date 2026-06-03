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
const JWT_REGEX = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
const IPv4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPv6_REGEX = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::$|^([0-9a-fA-F]{1,4}:){1,7}:$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function validateNickname(nickname: string): ValidationResult {
  if (typeof nickname !== 'string') {
    return { valid: false, error: '昵称必须是字符串类型' };
  }

  if (nickname.trim() === '') {
    return { valid: false, error: '昵称不能为空' };
  }

  const trimmedNickname = nickname.trim();

  if (trimmedNickname.length < MIN_NICKNAME_LENGTH) {
    return { valid: false, error: `昵称长度不能少于 ${MIN_NICKNAME_LENGTH} 个字符` };
  }

  if (trimmedNickname.length > MAX_NICKNAME_LENGTH) {
    return { valid: false, error: `昵称长度不能超过 ${MAX_NICKNAME_LENGTH} 个字符` };
  }

  if (!NICKNAME_REGEX.test(trimmedNickname)) {
    return { valid: false, error: '昵称只能包含字母、数字和下划线，且首字符必须为字母' };
  }

  return { valid: true };
}

export function validateRoomName(roomName: string): ValidationResult {
  if (typeof roomName !== 'string') {
    return { valid: false, error: '房间名必须是字符串类型' };
  }

  if (roomName.trim() === '') {
    return { valid: false, error: '房间名不能为空' };
  }

  const trimmedRoomName = roomName.trim();

  if (!trimmedRoomName.startsWith('#')) {
    return { valid: false, error: '房间名必须以 # 开头' };
  }

  const nameWithoutHash = trimmedRoomName.slice(1);

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
  if (typeof text !== 'string') {
    return { valid: false, error: '消息内容必须是字符串类型' };
  }

  if (text.trim() === '') {
    return { valid: false, error: '消息内容不能为空' };
  }

  if (text.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `消息长度不能超过 ${MAX_MESSAGE_LENGTH} 个字符` };
  }

  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (typeof password !== 'string') {
    return { valid: false, error: '密码必须是字符串类型' };
  }

  if (password.trim() === '') {
    return { valid: false, error: '密码不能为空' };
  }

  if (password.length < 6) {
    return { valid: false, error: '密码长度不能少于 6 个字符' };
  }

  return { valid: true };
}

export function validateFileSize(size: number, maxSize: number): ValidationResult {
  if (typeof size !== 'number' || typeof maxSize !== 'number') {
    return { valid: false, error: '文件大小参数必须是数字类型' };
  }

  if (size < 0) {
    return { valid: false, error: '文件大小不能为负数' };
  }

  if (size === 0) {
    return { valid: false, error: '文件大小必须大于 0' };
  }

  if (maxSize <= 0) {
    return { valid: false, error: '最大文件大小必须大于 0' };
  }

  if (size > maxSize) {
    return { valid: false, error: `文件大小不能超过 ${Math.round(maxSize / 1024 / 1024)} MB` };
  }

  return { valid: true };
}

/**
 * 验证 JWT token 格式是否有效
 * @param token - 待验证的 JWT token
 * @returns ValidationResult 验证结果
 * 
 * JWT token 格式要求：
 * - 由三个 base64url 编码的部分组成
 * - 各部分之间用点号分隔
 * - 每个部分只能包含字母、数字、连字符和下划线
 */
export function validateToken(token: string): ValidationResult {
  if (typeof token !== 'string') {
    return { valid: false, error: 'Token 必须是字符串类型' };
  }

  if (token.trim() === '') {
    return { valid: false, error: 'Token 不能为空' };
  }

  if (!JWT_REGEX.test(token)) {
    return { valid: false, error: 'Token 格式不正确' };
  }

  const parts = token.split('.');
    
  if (parts.length !== 3) {
    return { valid: false, error: 'Token 必须包含三个部分' };
  }

  const [header, payload, signature] = parts;

  if (!header || !payload || !signature) {
    return { valid: false, error: 'Token 的各个部分不能为空' };
  }

  return { valid: true };
}

/**
 * 验证 IP 地址格式是否有效（支持 IPv4 和 IPv6）
 * @param ip - 待验证的 IP 地址
 * @returns ValidationResult 验证结果
 */
export function validateIpAddress(ip: string): ValidationResult {
  if (typeof ip !== 'string') {
    return { valid: false, error: 'IP 地址必须是字符串类型' };
  }

  if (ip.trim() === '') {
    return { valid: false, error: 'IP 地址不能为空' };
  }

  const trimmedIp = ip.trim();

  const isIPv4 = IPv4_REGEX.test(trimmedIp);
  const isIPv6 = IPv6_REGEX.test(trimmedIp) || isShortenedIPv6(trimmedIp);

  if (!isIPv4 && !isIPv6) {
    return { valid: false, error: 'IP 地址格式不正确（不支持的 IPv4 或 IPv6 格式）' };
  }

  return { valid: true };
}

/**
 * 检查是否为缩短形式的 IPv6 地址
 * @param ip - 待检查的 IP 地址
 * @returns boolean 是否为有效的缩短形式 IPv6
 */
function isShortenedIPv6(ip: string): boolean {
  if (!ip.includes('::')) {
    return false;
  }

  if (ip.split('::').length > 2) {
    return false;
  }

  const parts = ip.split(':');
  let emptyCount = 0;
    
  for (const part of parts) {
    if (part === '') {
      emptyCount++;
    } else if (!/^[0-9a-fA-F]{1,4}$/.test(part)) {
      return false;
    }
  }

  return emptyCount <= 2;
}

/**
 * 验证端口号是否有效
 * @param port - 待验证的端口号（数字或字符串）
 * @returns ValidationResult 验证结果
 * 
 * 有效端口号范围：1-65535
 * 0 通常用于临时端口分配，但在此验证中视为无效
 */
export function validatePort(port: number | string): ValidationResult {
  let portNum: number;

  if (typeof port === 'string') {
    if (port.trim() === '') {
      return { valid: false, error: '端口号不能为空' };
    }

    if (!/^[0-9]+$/.test(port.trim())) {
      return { valid: false, error: '端口号必须是数字' };
    }

    portNum = parseInt(port, 10);
  } else if (typeof port === 'number') {
    if (isNaN(port)) {
      return { valid: false, error: '端口号不能是 NaN' };
    }
    portNum = port;
  } else {
    return { valid: false, error: '端口号必须是数字或数字字符串类型' };
  }

  if (!Number.isInteger(portNum)) {
    return { valid: false, error: '端口号必须是整数' };
  }

  if (portNum < 1 || portNum > 65535) {
    return { valid: false, error: '端口号必须在 1-65535 范围内' };
  }

  return { valid: true };
}

/**
 * 验证文件扩展名是否在允许的列表中
 * @param filename - 文件名（包含扩展名）
 * @param allowedExtensions - 允许的扩展名列表（不含点号）
 * @returns ValidationResult 验证结果
 * 
 * 示例：
 * validateFileExtension('document.pdf', ['pdf', 'doc', 'docx']) => { valid: true }
 * validateFileExtension('image.png', ['jpg', 'jpeg']) => { valid: false, error: '...' }
 */
export function validateFileExtension(filename: string, allowedExtensions: string[]): ValidationResult {
  if (typeof filename !== 'string') {
    return { valid: false, error: '文件名必须是字符串类型' };
  }

  if (filename.trim() === '') {
    return { valid: false, error: '文件名不能为空' };
  }

  if (!Array.isArray(allowedExtensions)) {
    return { valid: false, error: '允许的扩展名列表必须是数组' };
  }

  if (allowedExtensions.length === 0) {
    return { valid: false, error: '允许的扩展名列表不能为空' };
  }

  const trimmedFilename = filename.trim();
    
  const dotIndex = trimmedFilename.lastIndexOf('.');
    
  if (dotIndex === -1 || dotIndex === 0 || dotIndex === trimmedFilename.length - 1) {
    return { valid: false, error: '文件名必须包含有效的扩展名' };
  }

  const extension = trimmedFilename.slice(dotIndex + 1).toLowerCase();
  const normalizedAllowedExtensions = allowedExtensions.map(e => e.toLowerCase());

  if (!normalizedAllowedExtensions.includes(extension)) {
    return { 
      valid: false, 
      error: `文件扩展名不允许，仅支持：${allowedExtensions.join(', ')}` 
    };
  }

  return { valid: true };
}

/**
 * 验证密码强度是否符合要求
 * @param password - 待验证的密码
 * @param options - 密码强度选项（可选）
 * @returns ValidationResult 验证结果
 * 
 * 默认要求：
 * - 最小长度 8 位
 * - 至少包含一个大写字母
 * - 至少包含一个小写字母
 * - 至少包含一个数字
 * - 至少包含一个特殊字符（非字母数字）
 */
export interface PasswordStrengthOptions {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumber?: boolean;
    requireSpecialChar?: boolean;
}

export function validatePasswordStrength(
  password: string,
  options: PasswordStrengthOptions = {}
): ValidationResult {
  if (typeof password !== 'string') {
    return { valid: false, error: '密码必须是字符串类型' };
  }

  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumber = true,
    requireSpecialChar = true,
  } = options;

  if (password.length < minLength) {
    return { valid: false, error: `密码长度不能少于 ${minLength} 个字符` };
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    return { valid: false, error: '密码必须包含至少一个大写字母' };
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    return { valid: false, error: '密码必须包含至少一个小写字母' };
  }

  if (requireNumber && !/[0-9]/.test(password)) {
    return { valid: false, error: '密码必须包含至少一个数字' };
  }

  if (requireSpecialChar && !/[^a-zA-Z0-9]/.test(password)) {
    return { valid: false, error: '密码必须包含至少一个特殊字符' };
  }

  return { valid: true };
}

/**
 * 验证电子邮件格式是否有效
 * @param email - 待验证的电子邮件地址
 * @returns ValidationResult 验证结果
 * 
 * 支持的格式：
 * - 用户名部分：字母、数字、点号、下划线、百分号、加号、连字符
 * - 域名部分：字母、数字、点号、连字符
 * - 顶级域名：至少 2 个字母
 */
export function validateEmail(email: string): ValidationResult {
  if (typeof email !== 'string') {
    return { valid: false, error: '电子邮件必须是字符串类型' };
  }

  if (email.trim() === '') {
    return { valid: false, error: '电子邮件不能为空' };
  }

  const trimmedEmail = email.trim();

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return { valid: false, error: '电子邮件格式不正确' };
  }

  if (trimmedEmail.length > 254) {
    return { valid: false, error: '电子邮件长度不能超过 254 个字符' };
  }

  return { valid: true };
}