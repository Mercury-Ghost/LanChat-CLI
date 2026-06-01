# LanChat CLI API 文档

欢迎使用 LanChat CLI 的 API 文档！这里提供了完整的项目文档体系，帮助您快速理解和使用 LanChat CLI 的各个模块。

---

## 📚 文档导航

### 核心模块文档

| 模块 | 说明 | 快速链接
------|------|---------
**Shared 模块 | 共享库（常量、工具、协议 | [shared-api.md](./shared-api.md)
**Client 模块** | 客户端实现（TUI、传输、认证） | [client-api.md](./client-api.md)
**Server 模块** | 服务端实现（TLS、房间、文件传输） | [server-api.md](./server-api.md)

### 辅助文档

| 文档 | 说明 | 链接
------|------|------
**通信协议** | 二进制协议定义 | [protocol.md](../protocol.md)
**设计文档** | 项目设计说明 | [设计文档.md](../设计文档.md)
**README** | 项目总览和快速开始 | [README.md](../README.md)

---

## 🏗️ 项目架构概览

```mermaid
flowchart TB
    Client["客户端
    (src/client/"]
    Server["服务端
    (src/server/)"]
    Shared["共享模块
    (src/shared/)"]

    Client --->|协议通信--> Server
    
    subgraph " "
      subgraph Client
        ChatClient --> AuthClient
        TuiManager --> ChatWindow
        ChatClient --> TlsTransport
        ChatClient --> FileTransferClient
        ChatClient --> CommandHandler
    end
    
    subgraph Server
        TlsServer --> ClientConnection
        ClientConnection --> MessageRouter
        MessageRouter --> AuthManager
        MessageRouter --> UserManager
        MessageRouter --> RoomManager
        MessageRouter --> ChatService
        MessageRouter --> FileService
    end
    
    subgraph Shared
        constants
        errors
        validators
        utils
        codec[MessageCodec]
        protocol[protocol types]
        fileUtils[FileSplitter]
    end
    
    Client --> Shared
    Server --> Shared
```

---

## 🔧 快速开始指南

### 开发新开发者

```typescript
// 客户端快速示例

import { ChatClient } from '../src/client';

const client = new ChatClient();

// 连接到服务器
await client.connect('localhost', 9527);

// 注册用户
await client.register('myNickname', 'password123');

// 发送消息
await client.sendRoomMessage('#general', 'Hello, world!');
```

### 服务端开发者

```typescript
// 服务器快速启动
import { TlsServer } from '../src/server';

const server = new TlsServer();
server.start(9527);
```

---

## 📖 详细文档导航

### 1. 客户端开发

1. **[Client API 文档](./client-api.md)
   - ChatClient 类
   - TUI 组件
   - 传输层接口
   - 文件传输客户端
   - 命令处理器

### 2. 服务端开发

2. **[Server API 文档](./server-api.md)
   - TlsServer
   - 房间和用户管理
   - 认证服务
   - 数据访问层
   - 部署指南

### 3. 共享模块使用

3. **[Shared API 文档](./shared-api.md)
   - 协议编解码器
   - 验证器
   - 工具函数
   - 常量和类型定义

---

## 💡 常见问题

### 如何选择模块文档

- 如果您在开发客户端，请从 [Client API](./client-api.md) 开始
- 如果您在开发服务端，请从 [Server API](./server-api.md) 开始
- 如果您需要共享工具函数，请查看 [Shared API](./shared-api.md)

### 协议理解

- 了解项目使用自定义二进制协议，详见 [protocol.md](../protocol.md)

---

## 📄 许可证

本项目使用 MIT 许可证开源。

---

## 🚀 祝您开发愉快！
