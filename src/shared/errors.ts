export enum ErrorCode {
    AUTH_FAILED = 'AUTH_FAILED',
    NICK_TAKEN = 'NICK_TAKEN',
    INVALID_MESSAGE = 'INVALID_MESSAGE',
    ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
    TARGET_OFFLINE = 'TARGET_OFFLINE',
    FILE_TOO_LARGE = 'FILE_TOO_LARGE',
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    INVALID_TOKEN = 'INVALID_TOKEN',
    PERMISSION_DENIED = 'PERMISSION_DENIED',
    INVALID_FORMAT = 'INVALID_FORMAT',
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    ALREADY_IN_ROOM = 'ALREADY_IN_ROOM',
    CANNOT_LEAVE_DEFAULT_ROOM = 'CANNOT_LEAVE_DEFAULT_ROOM',
    RESOURCE_LIMIT_EXCEEDED = 'RESOURCE_LIMIT_EXCEEDED',
}

export class AppError extends Error {
  constructor(
        public readonly code: ErrorCode,
        message: string,
        public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class AuthError extends AppError {
  constructor(message: string = '认证失败') {
    super(ErrorCode.AUTH_FAILED, message, 401);
    this.name = 'AuthError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(ErrorCode.INVALID_MESSAGE, message, 400);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(ErrorCode.ROOM_NOT_FOUND, `${resource} 不存在`, 404);
    this.name = 'NotFoundError';
  }
}

export class InternalError extends AppError {
  constructor(message: string = '服务器内部错误') {
    super(ErrorCode.INTERNAL_ERROR, message, 500);
    this.name = 'InternalError';
  }
}

export class ResourceLimitError extends AppError {
  constructor(message: string = '资源限制已达上限') {
    super(ErrorCode.RESOURCE_LIMIT_EXCEEDED, message, 429);
    this.name = 'ResourceLimitError';
  }
}

export function getErrorMessage(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    [ErrorCode.AUTH_FAILED]: '登录/令牌验证失败',
    [ErrorCode.NICK_TAKEN]: '昵称已被占用',
    [ErrorCode.INVALID_MESSAGE]: '消息格式不合法',
    [ErrorCode.ROOM_NOT_FOUND]: '房间不存在',
    [ErrorCode.TARGET_OFFLINE]: '目标用户不在线',
    [ErrorCode.FILE_TOO_LARGE]: '文件超过大小限制',
    [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
    [ErrorCode.INVALID_TOKEN]: '令牌无效或已过期',
    [ErrorCode.PERMISSION_DENIED]: '权限不足',
    [ErrorCode.INVALID_FORMAT]: '数据格式错误',
    [ErrorCode.USER_NOT_FOUND]: '用户不存在',
    [ErrorCode.ALREADY_IN_ROOM]: '已在该房间中',
    [ErrorCode.CANNOT_LEAVE_DEFAULT_ROOM]: '不能离开默认房间',
    [ErrorCode.RESOURCE_LIMIT_EXCEEDED]: '资源限制已达上限',
  };
  return messages[code] || '未知错误';
}
