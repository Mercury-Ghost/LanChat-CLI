# LanChat-CLI 架构职责划分文档

## 1. 概述

本文档明确了 LanChat-CLI 项目中 Manager 层和 Service 层的职责划分，确保架构清晰、职责单一、易于维护。

## 2. 分层架构原则

LanChat-CLI 采用清晰的分层架构：

```
┌─────────────────────────────────────────┐
│         Handlers (消息处理层)            │
├─────────────────────────────────────────┤
│         Services (业务逻辑层)           │
├─────────────────────────────────────────┤
│         Managers (状态管理层)           │
├─────────────────────────────────────────┤
│         Repositories (数据访问层)       │
├─────────────────────────────────────────┤
│         Database (数据库层)             │
└─────────────────────────────────────────┘
```

## 3. 职责划分详细说明

### 3.1 Repositories 层 (数据访问层)

**职责：**
- 纯粹的数据 CRUD 操作
- 参数化查询，防止 SQL 注入
- 与具体数据库实现解耦
- 不包含业务逻辑

**位置：** `src/server/repositories/`

**现有组件：**
- `UserRepo` - 用户数据访问
- `RoomRepo` - 房间数据访问
- `MessageRepo` - 消息数据访问
- `FileRepo` - 文件元数据访问

### 3.2 Managers 层 (状态管理层)

**职责：**
- 管理运行时状态（内存中的数据）
- 提供高效的查找和索引
- 维护数据一致性和完整性
- 不直接操作数据库（通过 Repositories）
- 不处理复杂业务逻辑

**位置：** `src/server/`

**现有组件：**

#### 3.2.1 `AuthManager`
- **核心职责：**
  - 密码哈希和验证（Argon2id）
  - JWT 令牌生成和验证
  - 直接调用 UserRepo 进行数据库操作

#### 3.2.2 `UserManager`
- **核心职责：**
  - 管理在线用户状态（socketId → OnlineUser 映射）
  - 维护用户索引（userId、nickname 双向索引）
  - 管理用户当前活跃房间
  - 确保昵称在线唯一性

#### 3.2.3 `RoomManager`
- **核心职责：**
  - 管理房间列表和成员关系
  - 维护房间成员集合
  - 处理房间加入/离开逻辑
  - 默认房间管理

### 3.3 Services 层 (业务逻辑层)

**职责：**
- 协调各组件完成业务流程
- 输入验证（调用 validators）
- 事务管理（如需要）
- 调用 Repositories 访问数据
- 调用 Managers 管理状态
- 不直接操作数据库或维护状态

**位置：** `src/server/services/`

**现有组件：**

#### 3.3.1 `AuthService`
- **核心职责：**
  - 注册流程验证（昵称格式、密码强度）
  - 登录流程验证
  - 密码修改验证
  - 协调 AuthManager 完成认证
  - 不直接处理密码哈希或 JWT 生成

#### 3.3.2 `ChatService`
- **核心职责：**
  - 房间消息发送流程（保存+广播）
  - 私聊消息发送流程（保存+发送）
  - 历史消息查询
  - 系统消息发送
  - 协调 UserManager、RoomManager 和 Repositories

#### 3.3.3 `FileService`
- **核心职责：**
  - 文件传输业务逻辑
  - 文件元数据管理

### 3.4 Handlers 层 (消息处理层)

**职责：**
- 接收和解析客户端消息
- 调用相应的 Service 处理业务
- 返回响应给客户端
- 错误处理和转换

**位置：** `src/server/handlers/`

## 4. 代码组织示例

### 4.1 正确的调用链

```typescript
// Handler → Service → Manager/Repository
AuthHandler.register() 
  → AuthService.register()
    → validateNickname() / validatePasswordStrength()
    → AuthManager.register()
      → UserRepo.create()

// 或
ChatHandler.sendRoomMessage()
  → ChatService.sendRoomMessage()
    → RoomRepo.findByName()
    → MessageRepo.createRoomMessage()
    → UserManager.getUsersInRoom()
    → Server.broadcastToRoom()
```

### 4.2 避免的反模式

❌ **错误：Manager 中包含业务逻辑**
```typescript
// 不推荐
class UserManager {
  async registerUser(nickname: string, password: string) {
    // 这里不应包含验证逻辑
    if (!nickname.match(/^[a-zA-Z][a-zA-Z0-9_]{2,19}$/)) {
      throw new Error('昵称格式错误');
    }
    // ...
  }
}
```

✅ **正确：验证逻辑放在 Service 层**
```typescript
// 推荐
class AuthService {
  async register(request: RegisterRequest) {
    // 验证放在 Service 层
    const validation = validateNickname(request.nickname);
    if (!validation.valid) {
      throw new ValidationError(validation.error!);
    }
    await this.authManager.register(request);
  }
}
```

## 5. 关键接口和数据流

### 5.1 用户注册流程

```
1. Client → REGISTER_REQUEST
2. AuthHandler.register()
3. AuthService.register()
   - validateNickname()
   - validatePasswordStrength()
4. AuthManager.register()
   - UserRepo.findByNickname()
   - hashPassword()
   - UserRepo.create()
5. 返回 REGISTER_RESPONSE
```

### 5.2 房间聊天流程

```
1. Client → CHAT_ROOM
2. MessageRouter.route()
   - verifyToken()
3. ChatHandler.handleChatRoom()
4. ChatService.sendRoomMessage()
   - RoomRepo.findByName()
   - MessageRepo.createRoomMessage()
   - Server.broadcastToRoom()
5. 广播给房间所有用户
```

## 6. 重构建议（如需要）

当前架构已经相对清晰，但可以考虑以下优化：

1. **依赖注入：** 引入简单的 DI 容器，减少手动实例化
2. **事件驱动：** 使用事件总线解耦组件间通信
3. **接口抽象：** 为 Manager 和 Service 定义接口，便于测试和替换

## 7. 总结

| 层级 | 职责 | 示例 |
|------|------|------|
| Repository | 纯数据访问 | UserRepo.create() |
| Manager | 状态管理和索引 | UserManager.addUser() |
| Service | 业务流程和验证 | AuthService.register() |
| Handler | 消息处理和路由 | AuthHandler.login() |

遵循此职责划分原则，确保代码可维护、可测试、可扩展。
