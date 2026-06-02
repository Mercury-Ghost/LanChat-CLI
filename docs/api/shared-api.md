# Shared 模块 API 文档

## 1. 目录

- [1.1 模块概述](#11-模块概述)
- [1.2 技术栈](#12-技术栈)
- [2. 快速开始指南](#2-快速开始指南)
- [3. 常量参考](#3-常量参考)
- [4. 错误处理参考](#4-错误处理参考)
- [5. 验证器参考](#5-验证器参考)
- [6. 工具函数参考](#6-工具函数参考)
- [7. 协议编解码器参考](#7-协议编解码器参考)
- [8. 文件工具参考](#8-文件工具参考)
- [9. 类型定义参考](#9-类型定义参考)
- [10. 使用示例](#10-使用示例)
- [11. 附录](#11-附录)
- [12. 更新日志](#12-更新日志)

---

## 1. 模块概述

`shared` 模块是 LanChat CLI 项目的核心共享库，为客户端和服务端提供通用的工具函数、常量定义、错误处理、数据验证和协议编解码功能。该模块设计为跨平台兼容，可在客户端和服务端间无缝共享使用。

### 1.1 模块结构

```
src/shared/
├── index.ts              # 模块导出入口
├── constants.ts          # 常量配置
├── errors.ts            # 错误定义与处理
├── validators.ts        # 输入校验器
├── utils.ts             # 通用工具函数
└── protocol/
    ├── types.ts         # 协议类型定义
    ├── codec.ts         # 消息编解码器
    └── file.ts          # 文件处理工具
```

### 1.2 主要功能

- **常量管理**：集中管理项目配置常量，支持环境变量覆盖
- **错误处理**：统一的错误类型定义和错误消息映射
- **数据验证**：提供昵称、房间名、消息等输入的验证函数
- **工具函数**：时间格式化、文件大小格式化、JSON 安全解析等
- **协议编解码**：二进制消息的编码和解码
- **文件处理**：文件分块、重组和进度计算

### 1.2 技术栈

| 分类 | 技术 |
|------|------|
| 语言 | TypeScript |
| 运行时 | Node.js |
| 加密算法 | Argon2 |
| JWT | jsonwebtoken |
| 架构模式 | 工具库模式 |

---

## 2. 快速开始指南

### 2.1 安装与导入

```typescript
// 导入整个模块
import * as shared from './shared';

// 按需导入
import { ErrorCode, AppError, validateNickname } from './shared';
```

### 2.2 基础使用示例

```typescript
import {
  validateNickname,
  formatFileSize,
  MessageType,
  MessageCodec
} from './shared';

// 验证昵称
const result = validateNickname('alice123');
if (!result.valid) {
  console.error(result.error);
}

// 格式化文件大小
console.log(formatFileSize(1048576)); // "1 MB"

// 编码消息
const payload = { room: '#general', text: 'Hello!' };
const buffer = MessageCodec.encodeJson(MessageType.CHAT_ROOM, payload);
```

---

## 3. 常量参考

### 3.1 服务器配置

| 常量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `SERVER_PORT` | `number` | `9527` | 服务端监听端口 |
| `DEFAULT_HOST` | `string` | `'127.0.0.1'` | 客户端默认连接主机 |
| `DEFAULT_PORT` | `number` | `9527` | 客户端默认连接端口 |

### 3.2 JWT 配置

| 常量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `JWT_SECRET` | `string` | - | JWT 签名密钥（所有环境下必需配置） |
| `JWT_EXPIRES_IN` | `number` | `86400` | JWT 有效期（秒，24小时） |

### 3.3 Argon2 配置

| 常量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `ARGON2_TIME_COST` | `number` | `4` | Argon2id 时间成本 |
| `ARGON2_MEMORY_COST` | `number` | `65536` | Argon2id 内存成本（KB） |
| `ARGON2_PARALLELISM` | `number` | `2` | Argon2id 并行度 |
| `ARGON2_HASH_LENGTH` | `number` | `32` | 哈希输出长度（字节） |

### 3.4 心跳与连接配置

| 常量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `HEARTBEAT_INTERVAL` | `number` | `15000` | 心跳发送间隔（毫秒） |
| `HEARTBEAT_TIMEOUT` | `number` | `10000` | 心跳超时时间（毫秒） |
| `CONNECTION_TIMEOUT` | `number` | `30000` | 连接超时时间（毫秒） |

### 3.5 文件传输配置

| 常量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `MAX_FILE_SIZE` | `number` | `524288000` | 最大文件大小（字节，500MB） |
| `CHUNK_SIZE` | `number` | `65536` | 文件传输块大小（字节，64KB） |
| `PROGRESS_UPDATE_INTERVAL` | `number` | `1000` | 进度更新间隔（毫秒） |
| `PROGRESS_UPDATE_CHUNKS` | `number` | `10` | 进度更新块数 |
| `TEMP_FILE_RETENTION_HOURS` | `number` | `24` | 临时文件保留时间（小时） |

### 3.6 输入限制配置

| 常量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `MIN_NICKNAME_LENGTH` | `number` | `3` | 昵称最小长度 |
| `MAX_NICKNAME_LENGTH` | `number` | `20` | 昵称最大长度 |
| `MIN_ROOMNAME_LENGTH` | `number` | `1` | 房间名最小长度（不含#） |
| `MAX_ROOMNAME_LENGTH` | `number` | `30` | 房间名最大长度（不含#） |
| `MAX_MESSAGE_LENGTH` | `number` | `5000` | 消息最大长度 |
| `MAX_HISTORY_COUNT` | `number` | `200` | 历史消息最大数量 |
| `DEFAULT_HISTORY_COUNT` | `number` | `50` | 历史消息默认数量 |

### 3.7 路径配置

| 常量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `DB_PATH` | `string` | `'data/lanchat.db'` | SQLite 数据库路径 |
| `FILES_DIR` | `string` | `'data/files'` | 文件存储目录 |
| `CERT_PATH` | `string` | `'certs/server.crt'` | TLS 证书路径 |
| `KEY_PATH` | `string` | `'certs/server.key'` | TLS 私钥路径 |
| `LOG_LEVEL` | `string` | `'info'` | 日志级别 |

### 3.8 默认房间

| 常量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `DEFAULT_ROOM_NAME` | `string` | `'#general'` | 默认房间名称 |

---

## 4. 错误处理参考

### 4.1 ErrorCode 枚举

错误代码枚举，定义了所有可能的错误类型。

```typescript
enum ErrorCode {
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
}
```

### 4.2 AppError 类

基础应用错误类，所有自定义错误都继承自此类。

**构造函数参数：**
- `code: ErrorCode` - 错误代码
- `message: string` - 错误消息
- `statusCode: number` - HTTP 状态码（可选，默认 400）

**示例：**
```typescript
import { AppError, ErrorCode } from './shared';

throw new AppError(ErrorCode.ROOM_NOT_FOUND, '房间不存在', 404);
```

### 4.3 AuthError 类

认证错误类，用于登录失败等认证相关错误。

**构造函数参数：**
- `message: string` - 错误消息（可选，默认 '认证失败'）

**示例：**
```typescript
import { AuthError } from './shared';

throw new AuthError('密码错误');
```

### 4.4 ValidationError 类

验证错误类，用于输入验证失败。

**构造函数参数：**
- `message: string` - 错误消息

**示例：**
```typescript
import { ValidationError } from './shared';

throw new ValidationError('昵称格式不正确');
```

### 4.5 NotFoundError 类

未找到错误类，用于资源不存在的情况。

**构造函数参数：**
- `resource: string` - 资源名称

**示例：**
```typescript
import { NotFoundError } from './shared';

throw new NotFoundError('用户');
```

### 4.6 InternalError 类

内部错误类，用于服务器内部错误。

**构造函数参数：**
- `message: string` - 错误消息（可选，默认 '服务器内部错误'）

**示例：**
```typescript
import { InternalError } from './shared';

throw new InternalError('数据库连接失败');
```

### 4.7 getErrorMessage()

根据错误代码获取对应的错误消息。

**参数：**
- `code: ErrorCode` - 错误代码

**返回值：** `string` - 错误消息

**示例：**
```typescript
import { getErrorMessage, ErrorCode } from './shared';

const message = getErrorMessage(ErrorCode.AUTH_FAILED);
console.log(message); // "登录/令牌验证失败"
```

### 4.8 错误处理示例

```typescript
import { AppError, ErrorCode, getErrorMessage } from './shared';

try {
  // 可能抛出错误的代码
  throw new AppError(ErrorCode.NICK_TAKEN, '昵称已被占用');
} catch (error) {
  if (error instanceof AppError) {
    console.error(`错误 [${error.code}]: ${error.message}`);
    console.error(`HTTP 状态码: ${error.statusCode}`);
  } else {
    console.error('未知错误:', error);
  }
}
```

---

## 5. 验证器参考

### 5.1 ValidationResult 接口

所有验证函数返回的结果类型。

```typescript
interface ValidationResult {
  valid: boolean;
  error?: string;
}
```

### 5.2 validateNickname()

验证用户昵称格式。

**参数：**
- `nickname: string` - 待验证的昵称

**返回值：** `ValidationResult` - 验证结果

**验证规则：**
- 必须是字符串类型
- 不能为空
- 长度 3-20 字符
- 只能包含字母、数字和下划线
- 首字符必须是字母

**示例：**
```typescript
import { validateNickname } from './shared';

const result1 = validateNickname('alice123');
console.log(result1); // { valid: true }

const result2 = validateNickname('123alice');
console.log(result2); // { valid: false, error: '昵称只能包含字母、数字和下划线，且首字符必须为字母' }

const result3 = validateNickname('ab');
console.log(result3); // { valid: false, error: '昵称长度不能少于 3 个字符' }
```

### 5.3 validateRoomName()

验证房间名称格式。

**参数：**
- `roomName: string` - 待验证的房间名

**返回值：** `ValidationResult` - 验证结果

**验证规则：**
- 必须是字符串类型
- 不能为空
- 必须以 `#` 开头
- 长度 1-30 字符（不含 `#`）
- 只能包含字母、数字、连字符和下划线

**示例：**
```typescript
import { validateRoomName } from './shared';

const result1 = validateRoomName('#general');
console.log(result1); // { valid: true }

const result2 = validateRoomName('general');
console.log(result2); // { valid: false, error: '房间名必须以 # 开头' }

const result3 = validateRoomName('#');
console.log(result3); // { valid: false, error: '房间名长度不能少于 1 个字符' }
```

### 5.4 validateMessage()

验证消息内容。

**参数：**
- `text: string` - 待验证的消息文本

**返回值：** `ValidationResult` - 验证结果

**验证规则：**
- 必须是字符串类型
- 不能为空
- 长度不超过 5000 字符

**示例：**
```typescript
import { validateMessage } from './shared';

const result1 = validateMessage('Hello, world!');
console.log(result1); // { valid: true }

const result2 = validateMessage('');
console.log(result2); // { valid: false, error: '消息内容不能为空' }
```

### 5.5 validatePassword()

验证密码格式（基础验证）。

**参数：**
- `password: string` - 待验证的密码

**返回值：** `ValidationResult` - 验证结果

**验证规则：**
- 必须是字符串类型
- 不能为空
- 长度不小于 6 字符

**示例：**
```typescript
import { validatePassword } from './shared';

const result1 = validatePassword('secure123');
console.log(result1); // { valid: true }

const result2 = validatePassword('12345');
console.log(result2); // { valid: false, error: '密码长度不能少于 6 个字符' }
```

### 5.6 validateFileSize()

验证文件大小。

**参数：**
- `size: number` - 文件大小（字节）
- `maxSize: number` - 最大允许大小（字节）

**返回值：** `ValidationResult` - 验证结果

**验证规则：**
- 必须是数字类型
- 不能为负数
- 必须大于 0
- 不能超过最大限制

**示例：**
```typescript
import { validateFileSize, MAX_FILE_SIZE } from './shared';

const result1 = validateFileSize(1048576, MAX_FILE_SIZE);
console.log(result1); // { valid: true }

const result2 = validateFileSize(600 * 1024 * 1024, MAX_FILE_SIZE);
console.log(result2); // { valid: false, error: '文件大小不能超过 500 MB' }
```

### 5.7 validateToken()

验证 JWT token 格式。

**参数：**
- `token: string` - 待验证的 JWT token

**返回值：** `ValidationResult` - 验证结果

**验证规则：**
- 必须是字符串类型
- 不能为空
- 格式必须符合 JWT 规范（三部分，点分隔）

**示例：**
```typescript
import { validateToken } from './shared';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsaWNlIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const result = validateToken(token);
console.log(result); // { valid: true }
```

### 5.8 validateIpAddress()

验证 IP 地址格式（支持 IPv4 和 IPv6）。

**参数：**
- `ip: string` - 待验证的 IP 地址

**返回值：** `ValidationResult` - 验证结果

**示例：**
```typescript
import { validateIpAddress } from './shared';

const result1 = validateIpAddress('192.168.1.1');
console.log(result1); // { valid: true }

const result2 = validateIpAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
console.log(result2); // { valid: true }

const result3 = validateIpAddress('::1');
console.log(result3); // { valid: true }
```

### 5.9 validatePort()

验证端口号。

**参数：**
- `port: number | string` - 待验证的端口号

**返回值：** `ValidationResult` - 验证结果

**验证规则：**
- 必须是整数
- 范围 1-65535

**示例：**
```typescript
import { validatePort } from './shared';

const result1 = validatePort(8080);
console.log(result1); // { valid: true }

const result2 = validatePort('9527');
console.log(result2); // { valid: true }

const result3 = validatePort(0);
console.log(result3); // { valid: false, error: '端口号必须在 1-65535 范围内' }
```

### 5.10 validateFileExtension()

验证文件扩展名。

**参数：**
- `fileName: string` - 文件名（包含扩展名）
- `allowedExtensions: string[]` - 允许的扩展名列表（不含点号）

**返回值：** `ValidationResult` - 验证结果

**示例：**
```typescript
import { validateFileExtension } from './shared';

const result1 = validateFileExtension('document.pdf', ['pdf', 'doc', 'docx']);
console.log(result1); // { valid: true }

const result2 = validateFileExtension('image.png', ['jpg', 'jpeg']);
console.log(result2); // { valid: false, error: '文件扩展名不允许，仅支持：jpg, jpeg' }
```

### 5.11 PasswordStrengthOptions 接口

密码强度验证选项。

```typescript
interface PasswordStrengthOptions {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumber?: boolean;
  requireSpecialChar?: boolean;
}
```

**默认值：**
- `minLength: 8`
- `requireUppercase: true`
- `requireLowercase: true`
- `requireNumber: true`
- `requireSpecialChar: true`

### 5.12 validatePasswordStrength()

验证密码强度。

**参数：**
- `password: string` - 待验证的密码
- `options?: PasswordStrengthOptions` - 验证选项（可选）

**返回值：** `ValidationResult` - 验证结果

**示例：**
```typescript
import { validatePasswordStrength } from './shared';

const result1 = validatePasswordStrength('Secure123!');
console.log(result1); // { valid: true }

const result2 = validatePasswordStrength('password');
console.log(result2); // { valid: false, error: '密码必须包含至少一个大写字母' }

// 使用自定义选项
const result3 = validatePasswordStrength('mypassword', {
  minLength: 6,
  requireUppercase: false,
  requireNumber: false,
  requireSpecialChar: false
});
console.log(result3); // { valid: true }
```

### 5.13 validateEmail()

验证电子邮件格式。

**参数：**
- `email: string` - 待验证的电子邮件地址

**返回值：** `ValidationResult` - 验证结果

**示例：**
```typescript
import { validateEmail } from './shared';

const result1 = validateEmail('user@example.com');
console.log(result1); // { valid: true }

const result2 = validateEmail('invalid-email');
console.log(result2); // { valid: false, error: '电子邮件格式不正确' }
```

---

## 6. 工具函数参考

### 6.1 formatTimestamp()

格式化时间戳。

**参数：**
- `timestamp: Date | number` - 时间戳（Date 对象或毫秒数）
- `format?: string` - 格式字符串（可选，默认 `'YYYY-MM-DD HH:mm:ss'`）

**格式占位符：**
- `YYYY` - 年份（4位）
- `MM` - 月份（2位）
- `DD` - 日期（2位）
- `HH` - 小时（2位，24小时制）
- `mm` - 分钟（2位）
- `ss` - 秒（2位）

**返回值：** `string` - 格式化后的时间字符串

**示例：**
```typescript
import { formatTimestamp } from './shared';

const now = Date.now();
console.log(formatTimestamp(now)); // "2026-06-02 12:34:56"
console.log(formatTimestamp(now, 'YYYY/MM/DD')); // "2026/06/03"
console.log(formatTimestamp(now, 'HH:mm:ss')); // "12:34:56"
```

### 6.2 formatDate()

智能格式化日期，根据时间距离显示不同格式。

**参数：**
- `timestamp: Date | number` - 时间戳

**返回值：** `string` - 格式化后的日期字符串

**格式化规则：**
- 今天：显示时间（`HH:mm:ss`）
- 昨天：显示 "昨天 HH:mm:ss"
- 今年：显示月日和时间（`MM-DD HH:mm:ss`）
- 往年：显示完整日期（`YYYY-MM-DD HH:mm:ss`）

**示例：**
```typescript
import { formatDate } from './shared';

// 假设今天是 2026-06-02
const today = new Date('2026-06-02 12:34:56');
console.log(formatDate(today)); // "12:34:56"

const yesterday = new Date('2026-06-01 12:34:56');
console.log(formatDate(yesterday)); // "昨天 12:34:56"

const thisYear = new Date('2026-03-15 12:34:56');
console.log(formatDate(thisYear)); // "03-15 12:34:56"

const lastYear = new Date('2023-12-25 12:34:56');
console.log(formatDate(lastYear)); // "2023-12-25 12:34:56"
```

### 6.3 formatRelativeTime()

格式化相对时间。

**参数：**
- `timestamp: Date | number` - 时间戳

**返回值：** `string` - 相对时间字符串

**示例：**
```typescript
import { formatRelativeTime } from './shared';

const now = Date.now();

console.log(formatRelativeTime(now)); // "刚刚"
console.log(formatRelativeTime(now - 5 * 60 * 1000)); // "5分钟前"
console.log(formatRelativeTime(now - 2 * 60 * 60 * 1000)); // "2小时前"
console.log(formatRelativeTime(now - 3 * 24 * 60 * 60 * 1000)); // "3天前"
console.log(formatRelativeTime(now - 10 * 24 * 60 * 60 * 1000)); // "2026-05-23 12:34:56"
```

### 6.4 formatFileSize()

格式化文件大小为人类可读格式。

**参数：**
- `bytes: number` - 文件大小（字节）

**返回值：** `string` - 格式化后的文件大小字符串

**支持的单位：**
- B（字节）
- KB（千字节）
- MB（兆字节）
- GB（吉字节）
- TB（太字节）

**示例：**
```typescript
import { formatFileSize } from './shared';

console.log(formatFileSize(0)); // "0 B"
console.log(formatFileSize(512)); // "512 B"
console.log(formatFileSize(1024)); // "1 KB"
console.log(formatFileSize(1048576)); // "1 MB"
console.log(formatFileSize(1073741824)); // "1 GB"
console.log(formatFileSize(1572864)); // "1.5 MB"
```

### 6.5 truncateString()

截断字符串，超出部分用省略号表示。

**参数：**
- `str: string` - 原始字符串
- `maxLength: number` - 最大长度
- `suffix?: string` - 省略符（可选，默认 `'...'`）

**返回值：** `string` - 截断后的字符串

**示例：**
```typescript
import { truncateString } from './shared';

const longText = '这是一段很长的文本，需要截断处理';
console.log(truncateString(longText, 10)); // "这是一段很长的..."
console.log(truncateString('短文本', 20)); // "短文本"
console.log(truncateString(longText, 10, '>>>')); // "这是一段很长的>>>"
```

### 6.6 escapeHtml()

转义 HTML 特殊字符。

**参数：**
- `str: string` - 原始字符串

**返回值：** `string` - 转义后的字符串

**转义规则：**
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&#039;`

**示例：**
```typescript
import { escapeHtml } from './shared';

const html = '<script>alert("XSS")</script>';
console.log(escapeHtml(html)); // "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;"
```

### 6.7 sanitizeFileName()

清理文件名，移除或替换非法字符。

**参数：**
- `fileName: string` - 原始文件名

**返回值：** `string` - 清理后的文件名

**处理规则：**
- 替换非法字符（`<`, `>`, `:`, `"`, `/`, `\`, `|`, `?`, `*`）为 `_`
- 去除首尾空格
- 限制最大长度为 255 字符

**示例：**
```typescript
import { sanitizeFileName } from './shared';

console.log(sanitizeFileName('file:name?.txt')); // "file_name_.txt"
console.log(sanitizeFileName('  my file  ')); // "my file"
```

### 6.8 safeJsonParse()

安全解析 JSON，失败时返回默认值。

**参数：**
- `json: string` - JSON 字符串
- `defaultValue: T` - 解析失败时的默认值

**返回值：** `T` - 解析结果或默认值

**示例：**
```typescript
import { safeJsonParse } from './shared';

const result1 = safeJsonParse('{"name":"Alice"}', { name: 'Unknown' });
console.log(result1); // { name: 'Alice' }

const result2 = safeJsonParse('invalid json', { name: 'Unknown' });
console.log(result2); // { name: 'Unknown' }
```

### 6.9 safeJsonStringify()

安全序列化对象为 JSON，失败时返回默认值。

**参数：**
- `value: unknown` - 要序列化的值
- `defaultValue?: string` - 序列化失败时的默认值（可选，默认 `'{}'`）

**返回值：** `string` - JSON 字符串或默认值

**示例：**
```typescript
import { safeJsonStringify } from './shared';

const obj = { name: 'Alice', age: 30 };
console.log(safeJsonStringify(obj)); // '{"name":"Alice","age":30}'

const circular: any = {};
circular.self = circular;
console.log(safeJsonStringify(circular, '{}')); // '{}'
```

### 6.10 generateTransferId()

生成文件传输会话 ID。

**返回值：** `string` - UUID v4 格式的 ID

**示例：**
```typescript
import { generateTransferId } from './shared';

const transferId = generateTransferId();
console.log(transferId); // "550e8400-e29b-41d4-a716-446655440000"
```

### 6.11 debounce()

创建防抖函数。

**参数：**
- `func: T` - 要防抖的函数
- `wait: number` - 等待时间（毫秒）

**返回值：** `(...args: Parameters<T>) => void` - 防抖后的函数

**示例：**
```typescript
import { debounce } from './shared';

const expensiveOperation = (query: string) => {
  console.log('搜索:', query);
};

const debouncedSearch = debounce(expensiveOperation, 300);

debouncedSearch('a');
debouncedSearch('ab');
debouncedSearch('abc');
// 300ms 后只执行一次：Searching: abc
```

### 6.12 throttle()

创建节流函数。

**参数：**
- `func: T` - 要节流的函数
- `limit: number` - 时间间隔（毫秒）

**返回值：** `(...args: Parameters<T>) => void` - 节流后的函数

**示例：**
```typescript
import { throttle } from './shared';

const scrollHandler = () => {
  console.log('滚动更新');
};

const throttledScroll = throttle(scrollHandler, 100);

window.addEventListener('scroll', throttledScroll);
// 每 100ms 最多执行一次
```

---

## 7. 协议编解码器参考

### 7.1 MessageType 枚举

消息类型枚举，定义了所有协议消息类型。

```typescript
enum MessageType {
  LOGIN_REQUEST = 0x01,
  LOGIN_RESPONSE = 0x02,
  REGISTER_REQUEST = 0x03,
  REGISTER_RESPONSE = 0x04,
  HEARTBEAT = 0x05,
  HEARTBEAT_ACK = 0x06,
  DISCONNECT = 0x07,
  ERROR = 0x08,
  ROOM_LIST = 0x10,
  USER_LIST = 0x11,
  ROOM_JOIN = 0x12,
  ROOM_JOIN_RESPONSE = 0x13,
  ROOM_LEAVE = 0x14,
  USER_JOINED = 0x15,
  USER_LEFT = 0x16,
  NICK_CHANGE = 0x17,
  NICK_CHANGE_RESPONSE = 0x18,
  CHAT_ROOM = 0x20,
  CHAT_PRIVATE = 0x21,
  CHAT_SYSTEM = 0x22,
  HISTORY_REQUEST = 0x23,
  HISTORY_RESPONSE = 0x24,
  FILE_REQUEST = 0x30,
  FILE_RESPONSE = 0x31,
  FILE_CHUNK = 0x32,
  FILE_END = 0x33,
  FILE_PROGRESS = 0x34,
  CHANGE_PASSWORD = 0x40,
}
```

### 7.2 CodecError 类

编解码器错误类。

**构造函数参数：**
- `message: string` - 错误消息

### 7.3 DecodedMessage 接口

解码后的消息结构。

```typescript
interface DecodedMessage {
  type: MessageType;
  payload: Buffer;
}
```

### 7.4 MessageCodec 类

消息编解码核心类，所有方法都是静态方法。

#### 7.4.1 encode()

编码消息为二进制帧。

**参数：**
- `type: MessageType` - 消息类型
- `payload: Buffer | string` - 消息负载

**返回值：** `Buffer` - 编码后的二进制帧

**帧格式：**
```
[总长度(4字节, Big-Endian)][消息类型(1字节)][负载(可变)]
```

**示例：**
```typescript
import { MessageCodec, MessageType } from './shared';

const payload = Buffer.from('Hello, world!', 'utf8');
const frame = MessageCodec.encode(MessageType.CHAT_ROOM, payload);
```

#### 7.4.2 encodeJson()

编码 JSON 对象为二进制帧。

**参数：**
- `type: MessageType` - 消息类型
- `payload: object` - 消息负载对象

**返回值：** `Buffer` - 编码后的二进制帧

**示例：**
```typescript
import { MessageCodec, MessageType } from './shared';

const payload = {
  room: '#general',
  text: 'Hello, everyone!',
  timestamp: new Date().toISOString(),
  sender: 'alice'
};
const frame = MessageCodec.encodeJson(MessageType.CHAT_ROOM, payload);
```

#### 7.4.3 decode()

解码二进制帧。

**参数：**
- `frame: Buffer` - 二进制帧

**返回值：** `DecodedMessage` - 解码后的消息

**抛出：** `CodecError` - 当帧格式无效时

**示例：**
```typescript
import { MessageCodec, MessageType } from './shared';

// 假设 frame 是接收到的二进制数据
const decoded = MessageCodec.decode(frame);
console.log(decoded.type); // MessageType
console.log(decoded.payload); // Buffer
```

#### 7.4.4 decodeJson()

解码二进制帧并解析 JSON 负载。

**参数：**
- `frame: Buffer` - 二进制帧

**返回值：** `{ type: MessageType; payload: T }` - 解码后的消息

**抛出：** `CodecError` - 当帧格式无效时
**抛出：** `SyntaxError` - 当 JSON 解析失败时

**示例：**
```typescript
import { MessageCodec, MessageType } from './shared';

interface ChatRoomPayload {
  room: string;
  text: string;
  timestamp: string;
  sender: string;
}

// 假设 frame 是接收到的二进制数据
const { type, payload } = MessageCodec.decodeJson<ChatRoomPayload>(frame);
console.log(payload.room); // "#general"
console.log(payload.text); // "Hello, everyone!"
```

#### 7.4.5 parseStream()

从流数据中解析多个消息。

**参数：**
- `buffer: Buffer` - 流数据缓冲区

**返回值：** `{ messages: DecodedMessage[]; remaining: Buffer }` - 解析结果

**示例：**
```typescript
import { MessageCodec } from './shared';

// 假设 buffer 包含多个消息
let accumulatedBuffer = Buffer.alloc(0);

function onData(chunk: Buffer) {
  accumulatedBuffer = Buffer.concat([accumulatedBuffer, chunk]);
  const { messages, remaining } = MessageCodec.parseStream(accumulatedBuffer);
  
  for (const msg of messages) {
    console.log('Received message:', msg.type);
  }
  
  accumulatedBuffer = remaining;
}
```

### 7.5 编解码器常量

| 常量名 | 值 | 说明 |
|--------|-----|------|
| `FRAME_HEADER_SIZE` | `5` | 帧头部大小（字节） |
| `MAX_PAYLOAD_SIZE` | `10485760` | 最大负载大小（字节，10MB） |

---

## 8. 文件工具参考

### 8.1 FileChunk 接口

文件块数据结构。

```typescript
interface FileChunk {
  transferId: string;
  chunkIndex: number;
  data: Buffer;
  isLast: boolean;
}
```

### 8.2 FileMetadata 接口

文件元数据结构。

```typescript
interface FileMetadata {
  transferId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  receivedChunks: Set<number>;
}
```

### 8.3 FileSplitter 类

文件分块与重组工具类，所有方法都是静态方法。

#### 8.3.1 splitFile()

将文件缓冲区分割成多个块。

**参数：**
- `buffer: Buffer` - 文件数据缓冲区
- `transferId: string` - 传输会话 ID

**返回值：** `FileChunk[]` - 文件块数组

**示例：**
```typescript
import { FileSplitter, generateTransferId } from './shared';
import fs from 'fs';

const fileBuffer = fs.readFileSync('document.pdf');
const transferId = generateTransferId();
const chunks = FileSplitter.splitFile(fileBuffer, transferId);

console.log(`分割为 ${chunks.length} 个块`);
for (const chunk of chunks) {
  console.log(`块 ${chunk.chunkIndex}: ${chunk.data.length} 字节`);
}
```

#### 8.3.2 assembleChunks()

将多个文件块重组为完整文件。

**参数：**
- `chunks: Map<number, Buffer>` - 文件块映射（索引 → 数据）
- `totalChunks: number` - 总块数

**返回值：** `Buffer | null` - 重组后的文件缓冲区，失败返回 `null`

**示例：**
```typescript
import { FileSplitter } from './shared';
import fs from 'fs';

// 假设 receivedChunks 是接收到的块
const receivedChunks = new Map<number, Buffer>();
// ... 填充 receivedChunks ...

const totalChunks = 10;
const fileBuffer = FileSplitter.assembleChunks(receivedChunks, totalChunks);

if (fileBuffer) {
  fs.writeFileSync('received.pdf', fileBuffer);
  console.log('文件重组成功');
} else {
  console.log('文件重组失败，缺少部分块');
}
```

#### 8.3.3 calculateTotalChunks()

计算文件需要分成多少块。

**参数：**
- `fileSize: number` - 文件大小（字节）

**返回值：** `number` - 总块数

**示例：**
```typescript
import { FileSplitter, CHUNK_SIZE } from './shared';

const fileSize = 1024 * 1024; // 1MB
const totalChunks = FileSplitter.calculateTotalChunks(fileSize);
console.log(`需要 ${totalChunks} 个块，每块 ${CHUNK_SIZE} 字节`);
```

#### 8.3.4 getChunkRange()

获取从指定索引开始的块范围。

**参数：**
- `startChunk: number` - 起始块索引
- `totalChunks: number` - 总块数

**返回值：** `number[]` - 块索引数组

**示例：**
```typescript
import { FileSplitter } from './shared';

const range = FileSplitter.getChunkRange(5, 10);
console.log(range); // [5, 6, 7, 8, 9]
```

#### 8.3.5 getProgress()

计算传输进度百分比。

**参数：**
- `receivedChunks: Set<number>` - 已接收块索引集合
- `totalChunks: number` - 总块数

**返回值：** `number` - 进度百分比（0-100）

**示例：**
```typescript
import { FileSplitter } from './shared';

const received = new Set([0, 1, 2, 3, 4]);
const progress = FileSplitter.getProgress(received, 10);
console.log(`进度: ${progress}%`); // 50%
```

---

## 9. 类型定义参考

### 9.1 认证相关类型

#### AuthenticatedUser

已认证用户信息。

```typescript
interface AuthenticatedUser {
  userId: number;
  nickname: string;
  token: string;
}
```

#### OnlineUser

在线用户信息。

```typescript
interface OnlineUser {
  userId: number;
  nickname: string;
  socketId: string;
  activeRoom: string;
}
```

### 9.2 房间相关类型

#### RoomInfo

房间信息。

```typescript
interface RoomInfo {
  id: number;
  name: string;
  memberCount: number;
}
```

### 9.3 消息相关类型

#### Message

通用消息结构。

```typescript
interface Message {
  type: MessageType;
  payload: unknown;
}
```

#### HistoryMessage

历史消息。

```typescript
interface HistoryMessage {
  sender: string;
  content: string;
  timestamp: string;
}
```

#### ChatRoomMessage

房间聊天消息。

```typescript
interface ChatRoomMessage {
  room: string;
  sender: string;
  text: string;
  timestamp: string;
}
```

#### ChatPrivateMessage

私聊消息。

```typescript
interface ChatPrivateMessage {
  from: string;
  text: string;
  timestamp: string;
}
```

#### RoomListMessage

房间列表消息。

```typescript
interface RoomListMessage {
  rooms: RoomInfo[];
}
```

#### UserListMessage

用户列表消息。

```typescript
interface UserListMessage {
  users: OnlineUser[];
}
```

### 9.4 协议载荷类型

#### LoginRequest

登录请求载荷。

```typescript
interface LoginRequest {
  nickname: string;
  password: string;
}
```

#### LoginResponse

登录响应载荷。

```typescript
interface LoginResponse {
  success: boolean;
  token?: string;
  userId?: number;
  nickname?: string;
  error?: string;
}
```

#### RegisterRequest

注册请求载荷。

```typescript
interface RegisterRequest {
  nickname: string;
  password: string;
}
```

#### RegisterResponse

注册响应载荷。

```typescript
interface RegisterResponse {
  success: boolean;
  message?: string;
  error?: string;
}
```

#### DisconnectPayload

断开连接载荷。

```typescript
interface DisconnectPayload {
  reason?: string;
}
```

#### ErrorPayload

错误消息载荷。

```typescript
interface ErrorPayload {
  code: string;
  message: string;
}
```

#### RoomListPayload

房间列表载荷。

```typescript
interface RoomListPayload {
  rooms: RoomInfo[];
}
```

#### UserListPayload

用户列表载荷。

```typescript
interface UserListPayload {
  room: string;
  users: string[];
}
```

#### RoomJoinRequest

加入房间请求载荷。

```typescript
interface RoomJoinRequest {
  roomName: string;
  token?: string;
}
```

#### RoomJoinResponse

加入房间响应载荷。

```typescript
interface RoomJoinResponse {
  roomName?: string;
  success: boolean;
  error?: string;
}
```

#### RoomLeaveRequest

离开房间请求载荷。

```typescript
interface RoomLeaveRequest {
  roomName: string;
  token?: string;
}
```

#### UserJoinedPayload

用户加入通知载荷。

```typescript
interface UserJoinedPayload {
  nickname: string;
  room: string;
}
```

#### UserLeftPayload

用户离开通知载荷。

```typescript
interface UserLeftPayload {
  nickname: string;
  room: string;
}
```

#### NickChangeRequest

修改昵称请求载荷。

```typescript
interface NickChangeRequest {
  newNickname: string;
  token?: string;
}
```

#### NickChangeResponse

修改昵称响应载荷。

```typescript
interface NickChangeResponse {
  success: boolean;
  newNickname?: string;
  error?: string;
}
```

#### ChatRoomPayload

房间聊天载荷。

```typescript
interface ChatRoomPayload {
  room: string;
  text: string;
  timestamp: string;
  sender: string;
  token?: string;
}
```

#### ChatPrivatePayload

私聊载荷。

```typescript
interface ChatPrivatePayload {
  target: string;
  text: string;
  timestamp: string;
  sender: string;
  token?: string;
}
```

#### ChatSystemPayload

系统消息载荷。

```typescript
interface ChatSystemPayload {
  text: string;
  timestamp: string;
}
```

#### HistoryRequestPayload

历史消息请求载荷。

```typescript
interface HistoryRequestPayload {
  room?: string;
  target?: string;
  type?: 'room' | 'private';
  count?: number;
  token?: string;
}
```

#### HistoryResponsePayload

历史消息响应载荷。

```typescript
interface HistoryResponsePayload {
  messages: HistoryMessage[];
}
```

#### FileRequestPayload

文件传输请求载荷。

```typescript
interface FileRequestPayload {
  fileName: string;
  fileSize: number;
  targetUser?: string;
  room?: string;
  token?: string;
}
```

#### FileResponsePayload

文件传输响应载荷。

```typescript
interface FileResponsePayload {
  transferId: string;
  accepted: boolean;
  nextChunkIndex?: number;
  reason?: string;
}
```

#### FileChunkPayload

文件块载荷。

```typescript
interface FileChunkPayload {
  transferId: string;
  chunkIndex: number;
  data: string;
}
```

#### FileEndPayload

文件传输结束载荷。

```typescript
interface FileEndPayload {
  transferId: string;
  status: 'success' | 'aborted';
  reason?: string;
}
```

#### FileProgressPayload

文件传输进度载荷。

```typescript
interface FileProgressPayload {
  transferId: string;
  receivedBytes: number;
  totalBytes: number;
}
```

#### ChangePasswordRequest

修改密码请求载荷。

```typescript
interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
  token: string;
}
```

---

## 10. 使用示例

### 10.1 完整的消息发送与接收流程

```typescript
import {
  MessageType,
  MessageCodec,
  validateNickname,
  validateMessage,
  formatTimestamp
} from './shared';

// 1. 验证输入
const nicknameResult = validateNickname('alice');
if (!nicknameResult.valid) {
  throw new Error(nicknameResult.error);
}

const messageResult = validateMessage('Hello, world!');
if (!messageResult.valid) {
  throw new Error(messageResult.error);
}

// 2. 准备消息载荷
const payload = {
  room: '#general',
  text: 'Hello, world!',
  timestamp: formatTimestamp(new Date()),
  sender: 'alice'
};

// 3. 编码消息
const frame = MessageCodec.encodeJson(MessageType.CHAT_ROOM, payload);
console.log('编码后的帧大小:', frame.length, '字节');

// 4. 发送帧（模拟网络传输）
// socket.write(frame);

// 5. 接收并解码（模拟接收）
const receivedFrame = frame;
const { type, payload: receivedPayload } = MessageCodec.decodeJson<typeof payload>(receivedFrame);

console.log('消息类型:', MessageType[type]);
console.log('消息内容:', receivedPayload);
```

### 10.2 文件分块传输示例

```typescript
import {
  FileSplitter,
  generateTransferId,
  CHUNK_SIZE,
  formatFileSize
} from './shared';
import fs from 'fs';

// 发送端
async function sendFile(filePath: string) {
  const fileBuffer = fs.readFileSync(filePath);
  const transferId = generateTransferId();
  
  console.log(`文件大小: ${formatFileSize(fileBuffer.length)}`);
  console.log(`块大小: ${formatFileSize(CHUNK_SIZE)}`);
  
  const chunks = FileSplitter.splitFile(fileBuffer, transferId);
  console.log(`分割为 ${chunks.length} 个块`);
  
  for (const chunk of chunks) {
    // 发送每个块
    console.log(`发送块 ${chunk.chunkIndex}/${chunks.length - 1}`);
    // await sendChunk(chunk);
  }
  
  console.log('文件发送完成');
  return transferId;
}

// 接收端
async function receiveFile(transferId: string, totalChunks: number, outputPath: string) {
  const receivedChunks = new Map<number, Buffer>();
  
  while (receivedChunks.size < totalChunks) {
    // 接收块
    // const chunk = await receiveChunk();
    // receivedChunks.set(chunk.chunkIndex, chunk.data);
    
    // 显示进度
    const progress = FileSplitter.getProgress(new Set(receivedChunks.keys()), totalChunks);
    console.log(`接收进度: ${progress}%`);
  }
  
  const fileBuffer = FileSplitter.assembleChunks(receivedChunks, totalChunks);
  if (fileBuffer) {
    fs.writeFileSync(outputPath, fileBuffer);
    console.log('文件接收成功:', outputPath);
  } else {
    console.error('文件重组失败');
  }
}
```

### 10.3 流式消息解析示例

```typescript
import { MessageCodec, MessageType } from './shared';
import net from 'net';

class ProtocolHandler {
  private buffer: Buffer = Buffer.alloc(0);
  
  handleData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    
    const { messages, remaining } = MessageCodec.parseStream(this.buffer);
    
    for (const msg of messages) {
      this.handleMessage(msg);
    }
    
    this.buffer = remaining;
  }
  
  private handleMessage(msg: { type: MessageType; payload: Buffer }) {
    switch (msg.type) {
      case MessageType.CHAT_ROOM:
        const chatPayload = JSON.parse(msg.payload.toString('utf8'));
        console.log(`[${chatPayload.sender}] ${chatPayload.text}`);
        break;
      case MessageType.HEARTBEAT:
        console.log('收到心跳');
        break;
      // 处理其他消息类型...
    }
  }
}

// 使用示例
const handler = new ProtocolHandler();
const socket = net.connect(9527, 'localhost');

socket.on('data', (chunk) => {
  handler.handleData(chunk);
});
```

### 10.4 完整的错误处理示例

```typescript
import {
  AppError,
  ErrorCode,
  AuthError,
  ValidationError,
  NotFoundError,
  InternalError,
  getErrorMessage,
  validateNickname
} from './shared';

async function handleUserAction(action: string, data: any) {
  try {
    switch (action) {
      case 'register':
        const nickResult = validateNickname(data.nickname);
        if (!nickResult.valid) {
          throw new ValidationError(nickResult.error!);
        }
        // ... 注册逻辑 ...
        break;
        
      case 'login':
        // ... 登录逻辑 ...
        if (!success) {
          throw new AuthError('密码错误');
        }
        break;
        
      case 'joinRoom':
        // ... 加入房间逻辑 ...
        if (!roomExists) {
          throw new NotFoundError('房间');
        }
        break;
        
      default:
        throw new AppError(ErrorCode.INVALID_MESSAGE, '未知操作');
    }
  } catch (error) {
    if (error instanceof AppError) {
      console.error(`[${error.code}] ${error.message}`);
      console.error(`HTTP状态码: ${error.statusCode}`);
      
      // 获取友好的错误消息
      const friendlyMessage = getErrorMessage(error.code);
      console.error(`提示: ${friendlyMessage}`);
    } else {
      console.error('未知错误:', error);
      throw new InternalError();
    }
  }
}
```

### 10.5 工具函数综合使用示例

```typescript
import {
  formatDate,
  formatRelativeTime,
  formatFileSize,
  truncateString,
  escapeHtml,
  safeJsonParse,
  safeJsonStringify,
  debounce,
  throttle
} from './shared';

// 时间格式化
const now = Date.now();
console.log('智能日期:', formatDate(now));
console.log('相对时间:', formatRelativeTime(now - 3600000));

// 文件大小格式化
console.log('文件大小:', formatFileSize(1572864));

// 字符串处理
const longText = '这是一段非常长的文本，需要截断处理以显示';
console.log('截断:', truncateString(longText, 20));
console.log('HTML转义:', escapeHtml('<script>alert("hi")</script>'));

// JSON安全处理
const jsonStr = '{"name":"Alice","age":30}';
const obj = safeJsonParse(jsonStr, { name: 'Unknown' });
console.log('解析结果:', obj);
console.log('序列化:', safeJsonStringify(obj));

// 防抖与节流
const search = debounce((query: string) => {
  console.log('搜索:', query);
}, 300);

const scroll = throttle(() => {
  console.log('滚动更新');
}, 100);

// 模拟输入
search('a');
search('ab');
search('abc'); // 300ms 后只执行一次

// 模拟滚动
setInterval(() => scroll(), 50); // 每 100ms 最多执行一次
```

---

## 附录

### A. 环境变量配置

所有常量都支持通过环境变量覆盖：

| 环境变量 | 对应常量 |
|----------|----------|
| `PORT` | `SERVER_PORT` |
| `JWT_SECRET` | `JWT_SECRET` |
| `DB_PATH` | `DB_PATH` |
| `FILES_DIR` | `FILES_DIR` |
| `CERT_PATH` | `CERT_PATH` |
| `KEY_PATH` | `KEY_PATH` |
| `LOG_LEVEL` | `LOG_LEVEL` |
| `DEFAULT_HOST` | `DEFAULT_HOST` |
| `DEFAULT_PORT` | `DEFAULT_PORT` |
| `ARGON2_TIME_COST` | `ARGON2_TIME_COST` |
| `ARGON2_MEMORY_COST` | `ARGON2_MEMORY_COST` |
| `ARGON2_PARALLELISM` | `ARGON2_PARALLELISM` |
| `HEARTBEAT_INTERVAL` | `HEARTBEAT_INTERVAL` |
| `HEARTBEAT_TIMEOUT` | `HEARTBEAT_TIMEOUT` |
| `CONNECTION_TIMEOUT` | `CONNECTION_TIMEOUT` |
| `MAX_FILE_SIZE` | `MAX_FILE_SIZE` |
| `CHUNK_SIZE` | `CHUNK_SIZE` |
| `PROGRESS_UPDATE_INTERVAL` | `PROGRESS_UPDATE_INTERVAL` |
| `PROGRESS_UPDATE_CHUNKS` | `PROGRESS_UPDATE_CHUNKS` |
| `TEMP_FILE_RETENTION_HOURS` | `TEMP_FILE_RETENTION_HOURS` |

### B. 模块导出清单

完整的模块导出列表：

```typescript
// constants.ts
export {
  SERVER_PORT,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  DB_PATH,
  FILES_DIR,
  CERT_PATH,
  KEY_PATH,
  LOG_LEVEL,
  DEFAULT_HOST,
  DEFAULT_PORT,
  ARGON2_TIME_COST,
  ARGON2_MEMORY_COST,
  ARGON2_PARALLELISM,
  ARGON2_HASH_LENGTH,
  HEARTBEAT_INTERVAL,
  HEARTBEAT_TIMEOUT,
  CONNECTION_TIMEOUT,
  MAX_FILE_SIZE,
  CHUNK_SIZE,
  PROGRESS_UPDATE_INTERVAL,
  PROGRESS_UPDATE_CHUNKS,
  TEMP_FILE_RETENTION_HOURS,
  MIN_NICKNAME_LENGTH,
  MAX_NICKNAME_LENGTH,
  MIN_ROOMNAME_LENGTH,
  MAX_ROOMNAME_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_HISTORY_COUNT,
  DEFAULT_HISTORY_COUNT,
  DEFAULT_ROOM_NAME,
};

// errors.ts
export {
  ErrorCode,
  AppError,
  AuthError,
  ValidationError,
  NotFoundError,
  InternalError,
  getErrorMessage,
};

// validators.ts
export {
  ValidationResult,
  validateNickname,
  validateRoomName,
  validateMessage,
  validatePassword,
  validateFileSize,
  validateToken,
  validateIpAddress,
  validatePort,
  validateFileExtension,
  PasswordStrengthOptions,
  validatePasswordStrength,
  validateEmail,
};

// utils.ts
export {
  formatTimestamp,
  formatDate,
  formatRelativeTime,
  formatFileSize,
  truncateString,
  escapeHtml,
  sanitizeFileName,
  safeJsonParse,
  safeJsonStringify,
  generateTransferId,
  debounce,
  throttle,
};

// protocol/types.ts
export {
  MessageType,
  // ... 所有接口类型 ...
};

// protocol/codec.ts
export {
  CodecError,
  DecodedMessage,
  MessageCodec,
};

// protocol/file.ts
export {
  FileChunk,
  FileMetadata,
  FileSplitter,
};
```

---

## 12. 更新日志

### v1.0.0

- 初始版本发布
- 实现常量管理模块
- 实现错误处理模块
- 实现验证器模块
- 实现工具函数模块
- 实现协议编解码器模块
- 实现文件工具模块

---

**文档版本：** 1.0.0  
**最后更新：** 2026-06-02
