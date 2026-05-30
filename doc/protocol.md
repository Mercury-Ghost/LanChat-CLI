# LanChat CLI 通信协议文档

## 概述

本文档定义了 LanChat CLI 项目的客户端与服务端之间的通信协议。该协议基于 TCP/TLS，使用自定义二进制帧格式进行数据传输。

## 协议说明

### 连接建立

1. 客户端与服务端建立 TCP 连接
2. 进行 TLS 握手，验证证书
3. 客户端首次连接时需确认服务端证书指纹
4. 连接建立后，双方通过二进制帧进行通信

### 帧格式

每个消息由固定头部和可变负载组成：

| 字段 | 大小 | 说明 |
|------|------|------|
| 总长度 | 4 字节 | Big-Endian 格式，包含头部和负载的总字节数 |
| 消息类型 | 1 字节 | 标识消息类型的枚举值 |
| 负载 | 可变 | 实际数据内容 |

**总长度计算公式：**
```
总长度 = 5 字节（头部） + 负载长度
```

**最大负载大小：** 10 MB

### 消息编码

大多数消息类型使用 JSON 格式编码负载，但文件数据块（FILE_CHUNK）使用原始二进制数据。

## 消息类型定义

### 系统与控制类

#### 1. LOGIN_REQUEST (0x01)

**方向：** 客户端 → 服务端

**描述：** 用户登录请求

**请求负载：**
```typescript
{
  "nickname": "string",    // 用户昵称（3-20 字符）
  "password": "string"     // 用户密码
}
```

**示例：**
```json
{
  "nickname": "alice",
  "password": "securepassword123"
}
```

---

#### 2. LOGIN_RESPONSE (0x02)

**方向：** 服务端 → 客户端

**描述：** 登录请求响应

**响应负载：**
```typescript
{
  "success": "boolean",    // 登录是否成功
  "token": "string?",      // 成功时返回 JWT 令牌
  "nickname": "string?",   // 成功时返回用户昵称
  "error": "string?"       // 失败时返回错误信息
}
```

**成功示例：**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "nickname": "alice"
}
```

**失败示例：**
```json
{
  "success": false,
  "error": "密码错误"
}
```

---

#### 3. REGISTER_REQUEST (0x03)

**方向：** 客户端 → 服务端

**描述：** 用户注册请求

**请求负载：**
```typescript
{
  "nickname": "string",    // 用户昵称（3-20 字符，字母开头）
  "password": "string"     // 用户密码
}
```

**示例：**
```json
{
  "nickname": "bob",
  "password": "newpassword456"
}
```

---

#### 4. REGISTER_RESPONSE (0x04)

**方向：** 服务端 → 客户端

**描述：** 注册请求响应

**响应负载：**
```typescript
{
  "success": "boolean",    // 注册是否成功
  "error": "string?"       // 失败时返回错误信息
}
```

**成功示例：**
```json
{
  "success": true
}
```

**失败示例：**
```json
{
  "success": false,
  "error": "昵称已被占用"
}
```

---

#### 5. HEARTBEAT (0x05)

**方向：** 服务端 → 客户端

**描述：** 服务端心跳检测

**负载：** 无

---

#### 6. HEARTBEAT_ACK (0x06)

**方向：** 客户端 → 服务端

**描述：** 客户端心跳应答

**负载：** 无

---

#### 7. DISCONNECT (0x07)

**方向：** 双向

**描述：** 断开连接通知

**负载：**
```typescript
{
  "reason": "string?"      // 断开原因（可选）
}
```

**示例：**
```json
{
  "reason": "用户主动退出"
}
```

---

#### 8. ERROR (0x08)

**方向：** 服务端 → 客户端

**描述：** 错误信息通知

**负载：**
```typescript
{
  "code": "string",        // 错误代码
  "message": "string"      // 错误描述
}
```

**示例：**
```json
{
  "code": "AUTH_FAILED",
  "message": "需要登录才能执行此操作"
}
```

---

### 房间与用户类

#### 9. ROOM_LIST (0x10)

**方向：** 服务端 → 客户端

**描述：** 所有房间列表

**负载：**
```typescript
{
  "rooms": [
    {
      "id": "number",       // 房间 ID
      "name": "string",     // 房间名称
      "memberCount": "number" // 在线成员数
    }
  ]
}
```

**示例：**
```json
{
  "rooms": [
    {
      "id": 1,
      "name": "#general",
      "memberCount": 5
    },
    {
      "id": 2,
      "name": "#dev",
      "memberCount": 3
    }
  ]
}
```

---

#### 10. USER_LIST (0x11)

**方向：** 服务端 → 客户端

**描述：** 指定房间的用户列表

**负载：**
```typescript
{
  "room": "string",         // 房间名称
  "users": ["string"]       // 用户昵称数组
}
```

**示例：**
```json
{
  "room": "#general",
  "users": ["alice", "bob", "charlie"]
}
```

---

#### 11. ROOM_JOIN (0x12)

**方向：** 客户端 → 服务端

**描述：** 加入房间请求

**要求：** 需要携带有效的 JWT 令牌

**请求负载：**
```typescript
{
  "roomName": "string",     // 房间名称
  "token": "string"         // JWT 令牌
}
```

**示例：**
```json
{
  "roomName": "#dev",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### 12. ROOM_JOIN_RESPONSE (0x13)

**方向：** 服务端 → 客户端

**描述：** 加入房间响应

**响应负载：**
```typescript
{
  "room": "string",         // 房间名称
  "success": "boolean",     // 是否成功
  "error": "string?"        // 失败时返回错误信息
}
```

**成功示例：**
```json
{
  "room": "#dev",
  "success": true
}
```

**失败示例：**
```json
{
  "room": "#dev",
  "success": false,
  "error": "已在该房间中"
}
```

---

#### 13. ROOM_LEAVE (0x14)

**方向：** 客户端 → 服务端

**描述：** 离开房间请求

**要求：** 需要携带有效的 JWT 令牌

**请求负载：**
```typescript
{
  "roomName": "string",     // 房间名称
  "token": "string"         // JWT 令牌
}
```

**示例：**
```json
{
  "roomName": "#dev",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### 14. USER_JOINED (0x15)

**方向：** 服务端 → 客户端（广播）

**描述：** 用户加入房间通知

**负载：**
```typescript
{
  "nickname": "string",     // 加入的用户昵称
  "room": "string"          // 房间名称
}
```

**示例：**
```json
{
  "nickname": "david",
  "room": "#general"
}
```

---

#### 15. USER_LEFT (0x16)

**方向：** 服务端 → 客户端（广播）

**描述：** 用户离开房间通知

**负载：**
```typescript
{
  "nickname": "string",     // 离开的用户昵称
  "room": "string"          // 房间名称
}
```

**示例：**
```json
{
  "nickname": "charlie",
  "room": "#general"
}
```

---

#### 16. NICK_CHANGE (0x17)

**方向：** 客户端 → 服务端

**描述：** 修改昵称请求

**要求：** 需要携带有效的 JWT 令牌

**请求负载：**
```typescript
{
  "newNickname": "string",  // 新昵称
  "token": "string"         // JWT 令牌
}
```

**示例：**
```json
{
  "newNickname": "alice_new",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### 17. NICK_CHANGE_RESPONSE (0x18)

**方向：** 服务端 → 客户端

**描述：** 修改昵称响应

**响应负载：**
```typescript
{
  "success": "boolean",     // 是否成功
  "newNickname": "string?", // 成功时返回新昵称
  "error": "string?"        // 失败时返回错误信息
}
```

**成功示例：**
```json
{
  "success": true,
  "newNickname": "alice_new"
}
```

**失败示例：**
```json
{
  "success": false,
  "error": "昵称已被占用"
}
```

---

### 聊天消息类

#### 18. CHAT_ROOM (0x20)

**方向：** 客户端 → 服务端 → 其他客户端（广播）

**描述：** 房间聊天消息

**要求：** 客户端发送时需要携带有效的 JWT 令牌

**请求负载（客户端→服务端）：**
```typescript
{
  "room": "string",         // 房间名称
  "text": "string",         // 消息内容（最大 5000 字符）
  "timestamp": "string",    // ISO 8601 格式时间戳
  "sender": "string",       // 发送者昵称
  "token": "string"         // JWT 令牌
}
```

**响应负载（服务端→客户端）：**
```typescript
{
  "room": "string",         // 房间名称
  "text": "string",         // 消息内容
  "timestamp": "string",    // ISO 8601 格式时间戳
  "sender": "string"        // 发送者昵称
}
```

**示例：**
```json
{
  "room": "#general",
  "text": "大家好！",
  "timestamp": "2024-05-30T12:34:56.789Z",
  "sender": "alice",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### 19. CHAT_PRIVATE (0x21)

**方向：** 客户端 → 服务端 → 目标客户端

**描述：** 私聊消息

**要求：** 需要携带有效的 JWT 令牌

**请求负载（客户端→服务端）：**
```typescript
{
  "target": "string",       // 目标用户昵称
  "text": "string",         // 消息内容（最大 5000 字符）
  "timestamp": "string",    // ISO 8601 格式时间戳
  "sender": "string",       // 发送者昵称
  "token": "string"         // JWT 令牌
}
```

**响应负载（服务端→目标客户端）：**
```typescript
{
  "target": "string",       // 目标用户昵称
  "text": "string",         // 消息内容
  "timestamp": "string",    // ISO 8601 格式时间戳
  "sender": "string"        // 发送者昵称
}
```

**示例：**
```json
{
  "target": "bob",
  "text": "你好，有空吗？",
  "timestamp": "2024-05-30T12:34:56.789Z",
  "sender": "alice",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### 20. CHAT_SYSTEM (0x22)

**方向：** 服务端 → 客户端

**描述：** 系统通知消息

**负载：**
```typescript
{
  "text": "string",         // 系统通知内容
  "timestamp": "string"     // ISO 8601 格式时间戳
}
```

**示例：**
```json
{
  "text": "欢迎来到 LanChat！",
  "timestamp": "2024-05-30T12:34:56.789Z"
}
```

---

#### 21. HISTORY_REQUEST (0x23)

**方向：** 客户端 → 服务端

**描述：** 请求历史消息

**要求：** 需要携带有效的 JWT 令牌

**请求负载：**
```typescript
{
  "room": "string?",        // 房间名称（type=room 时必填）
  "type": "string",         // 类型：'room' 或 'private'
  "count": "number?",       // 消息数量（默认 50，最大 200）
  "token": "string"         // JWT 令牌
}
```

**房间历史示例：**
```json
{
  "room": "#general",
  "type": "room",
  "count": 50,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**私聊历史示例：**
```json
{
  "type": "private",
  "count": 50,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### 22. HISTORY_RESPONSE (0x24)

**方向：** 服务端 → 客户端

**描述：** 历史消息响应

**负载：**
```typescript
{
  "messages": [
    {
      "sender": "string",   // 发送者昵称
      "content": "string",  // 消息内容
      "timestamp": "string" // ISO 8601 格式时间戳
    }
  ]
}
```

**示例：**
```json
{
  "messages": [
    {
      "sender": "alice",
      "content": "大家好！",
      "timestamp": "2024-05-30T10:00:00.000Z"
    },
    {
      "sender": "bob",
      "content": "你好！",
      "timestamp": "2024-05-30T10:01:00.000Z"
    }
  ]
}
```

---

### 文件传输类

#### 23. FILE_REQUEST (0x30)

**方向：** 客户端 → 服务端

**描述：** 发送文件请求

**要求：** 需要携带有效的 JWT 令牌

**请求负载：**
```typescript
{
  "fileName": "string",     // 文件名
  "fileSize": "number",     // 文件大小（字节）
  "targetUser": "string?",  // 目标用户昵称（私聊传输）
  "room": "string?",        // 房间名称（群文件传输）
  "token": "string"         // JWT 令牌
}
```

**私聊文件示例：**
```json
{
  "fileName": "document.pdf",
  "fileSize": 1048576,
  "targetUser": "bob",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### 24. FILE_RESPONSE (0x31)

**方向：** 服务端 → 发送方；接收方 → 服务端

**描述：** 文件传输响应（接受/拒绝/续传）

**负载：**
```typescript
{
  "transferId": "string",   // 传输会话 ID
  "accepted": "boolean",    // 是否接受
  "nextChunkIndex": "number?", // 下一个需要传输的块索引（续传时使用）
  "reason": "string?"       // 拒绝原因（可选）
}
```

**接受示例：**
```json
{
  "transferId": "abc123",
  "accepted": true
}
```

**续传示例：**
```json
{
  "transferId": "abc123",
  "accepted": true,
  "nextChunkIndex": 5
}
```

**拒绝示例：**
```json
{
  "transferId": "abc123",
  "accepted": false,
  "reason": "空间不足"
}
```

---

#### 25. FILE_CHUNK (0x32)

**方向：** 发送方 → 服务端 → 接收方

**描述：** 文件数据块

**负载：** 原始二进制数据，按以下格式编码：
```
transferId (32 字节 ASCII 字符串) + chunkIndex (4 字节 Big-Endian) + 数据
```

---

#### 26. FILE_END (0x33)

**方向：** 双向

**描述：** 文件传输结束通知

**负载：**
```typescript
{
  "transferId": "string",   // 传输会话 ID
  "status": "string",       // 状态：'success' 或 'aborted'
  "reason": "string?"       // 中止原因（可选）
}
```

**成功示例：**
```json
{
  "transferId": "abc123",
  "status": "success"
}
```

**中止示例：**
```json
{
  "transferId": "abc123",
  "status": "aborted",
  "reason": "网络中断"
}
```

---

#### 27. FILE_PROGRESS (0x34)

**方向：** 服务端 → 双向

**描述：** 文件传输进度更新

**负载：**
```typescript
{
  "transferId": "string",   // 传输会话 ID
  "receivedBytes": "number", // 已接收字节数
  "totalBytes": "number"    // 总字节数
}
```

**示例：**
```json
{
  "transferId": "abc123",
  "receivedBytes": 524288,
  "totalBytes": 1048576
}
```

---

#### 28. CHANGE_PASSWORD (0x40)

**方向：** 客户端 → 服务端

**描述：** 修改密码请求

**要求：** 需要携带有效的 JWT 令牌

**请求负载：**
```typescript
{
  "oldPassword": "string",  // 旧密码
  "newPassword": "string",  // 新密码
  "token": "string"         // JWT 令牌
}
```

**示例：**
```json
{
  "oldPassword": "oldpass123",
  "newPassword": "newpass456",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 错误代码

| 错误代码 | 说明 |
|----------|------|
| AUTH_FAILED | 登录/令牌验证失败 |
| NICK_TAKEN | 昵称已被占用 |
| INVALID_MESSAGE | 消息格式不合法 |
| ROOM_NOT_FOUND | 房间不存在 |
| TARGET_OFFLINE | 目标用户不在线 |
| FILE_TOO_LARGE | 文件超过大小限制 |
| INTERNAL_ERROR | 服务器内部错误 |
| INVALID_TOKEN | 令牌无效或已过期 |
| PERMISSION_DENIED | 权限不足 |
| INVALID_FORMAT | 数据格式错误 |
| USER_NOT_FOUND | 用户不存在 |
| ALREADY_IN_ROOM | 已在该房间中 |
| CANNOT_LEAVE_DEFAULT_ROOM | 不能离开默认房间 |

## 认证说明

除以下消息类型外，所有客户端请求都需要在负载中携带有效的 JWT 令牌：
- LOGIN_REQUEST (0x01)
- REGISTER_REQUEST (0x03)
- HEARTBEAT (0x05)
- HEARTBEAT_ACK (0x06)

JWT 令牌有效期为 24 小时。

## 常量配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 服务端口 | 9527 | 服务端监听端口 |
| 心跳间隔 | 15000ms | 服务端发送心跳的间隔 |
| 心跳超时 | 10000ms | 客户端未响应心跳的超时时间 |
| 连接超时 | 30000ms | 无数据传输的超时时间 |
| 最大文件大小 | 524288000 (500MB) | 单文件最大大小 |
| 数据块大小 | 65536 (64KB) | 文件传输块大小 |
| 昵称最小长度 | 3 | 用户昵称最小字符数 |
| 昵称最大长度 | 20 | 用户昵称最大字符数 |
| 房间名最大长度 | 30 | 房间名称最大字符数 |
| 消息最大长度 | 5000 | 单条消息最大字符数 |
| 历史消息默认数量 | 50 | 默认请求的历史消息数 |
| 历史消息最大数量 | 200 | 单次可请求的最大历史消息数 |
| 默认房间名称 | #general | 用户登录后自动加入的房间 |
