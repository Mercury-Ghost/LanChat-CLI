# 局域网命令行聊天室 (LAN Chat CLI)

一个基于 Node.js 和 TypeScript 开发的局域网命令行聊天室应用，支持 TCP 协议通信、用户认证、房间管理、私聊等功能。

## 功能特性

### 核心功能
- ✅ **用户认证**: 支持注册、登录、Token 自动登录
- ✅ **房间管理**: 创建房间、加入/离开房间、房间列表
- ✅ **消息通信**: 群聊消息、私聊消息、系统消息
- ✅ **历史记录**: 查看房间历史消息、私聊历史消息

### 安全特性
- ✅ **密码验证**: 密码强度校验（大写、小写、数字、长度8-20位）
- ✅ **Token 管理**: JWT 令牌机制、令牌刷新、令牌注销
- ✅ **数据加密**: TLS 加密传输支持
- ✅ **日志系统**: 分级日志、日志轮转、错误追踪

### 用户体验
- ✅ **全屏刷新界面**: 模拟聊天软件的终端显示效果
- ✅ **自动重连**: 断线自动重连机制
- ✅ **心跳检测**: 连接状态实时监控

## 技术栈

- **语言**: TypeScript 5.x
- **运行时**: Node.js 20.x
- **数据库**: SQLite (sql.js)
- **加密**: Argon2id (密码哈希)、JWT (认证令牌)
- **日志**: Winston
- **TCP 通信**: Node.js net 模块

## 快速开始

### 环境要求

- Node.js >= 20.0.0
- npm >= 10.0.0

### 安装依赖

```bash
npm install
```

### 构建项目

```bash
npm run build
```

### 运行服务端

```bash
# 开发模式
npm run dev:server

# 生产模式
npm run start:server
```

### 运行客户端

```bash
# 开发模式
npm run dev:client

# 生产模式
npm run start:client
```

## 配置说明

创建 `.env` 文件配置应用：

```env
# 服务端端口
PORT=9527

# JWT 密钥（必须设置）
JWT_SECRET=your-secret-key-here

# 数据库路径
DB_PATH=data/lanchat.db

# 日志级别
LOG_LEVEL=info

# 是否启用 TLS
USE_TLS=false
TLS_CERT_PATH=certs/server.crt
TLS_KEY_PATH=certs/server.key
```

**注意**: `JWT_SECRET` 必须设置为一个安全的随机字符串，建议至少32位字符。

## 命令说明

| 命令 | 说明 | 示例 |
|------|------|------|
| `/join #房间名` | 加入指定房间 | `/join #general` |
| `/leave` | 离开当前房间 | `/leave` |
| `/rooms` | 列出所有房间 | `/rooms` |
| `/msg <昵称> <消息>` | 发送私聊消息 | `/msg Alice Hello!` |
| `/nick <新昵称>` | 修改昵称 | `/nick NewName` |
| `/list` | 列出当前房间在线用户 | `/list` |
| `/history [@昵称] [数量]` | 查看历史消息 | `/history 50` 或 `/history @Alice 20` |
| `/passwd` | 修改密码 | `/passwd` |
| `/quit` | 退出聊天室 | `/quit` |
| `/help` | 显示帮助信息 | `/help` |

## 项目结构

```
lanchat-cli/
├── src/
│   ├── server.ts          # 服务端主入口
│   ├── client.ts          # 客户端主入口
│   ├── shared/
│   │   ├── types.ts       # TypeScript 类型定义
│   │   ├── utils.ts       # 工具函数
│   │   └── wasm-data.ts   # sql.js WASM 数据
│   └── sqljs.d.ts         # sql.js 类型声明
├── dist/                  # 编译输出目录
├── data/                  # 数据库文件目录
├── logs/                  # 日志文件目录
├── certs/                 # TLS 证书目录
├── .env                   # 环境配置文件
├── package.json           # 项目配置
├── tsconfig.json          # TypeScript 配置
└── README.md              # 项目文档
```

## 协议说明

### 消息格式

应用使用自定义的二进制协议进行通信：

```
+----------------+----------------+----------------+
| 类型 (1字节)   | 长度 (4字节)   | 数据 (N字节)   |
+----------------+----------------+----------------+
```

### 消息类型

| 类型 | 值 | 说明 |
|------|-----|------|
| LOGIN_REQUEST | 0x01 | 登录请求 |
| LOGIN_RESPONSE | 0x02 | 登录响应 |
| REGISTER_REQUEST | 0x03 | 注册请求 |
| REGISTER_RESPONSE | 0x04 | 注册响应 |
| TOKEN_LOGIN_REQUEST | 0x09 | Token 登录请求 |
| TOKEN_LOGIN_RESPONSE | 0x0A | Token 登录响应 |
| TOKEN_REFRESH_REQUEST | 0x0B | Token 刷新请求 |
| TOKEN_REFRESH_RESPONSE | 0x0C | Token 刷新响应 |
| ROOM_JOIN_REQUEST | 0x14 | 加入房间请求 |
| ROOM_JOIN_RESPONSE | 0x15 | 加入房间响应 |
| CHAT_ROOM_MESSAGE | 0x20 | 群聊消息 |
| CHAT_PRIVATE_MESSAGE | 0x21 | 私聊消息 |

## 安全说明

### 密码策略

- 密码长度必须在 8-20 个字符之间
- 必须包含至少一个大写字母
- 必须包含至少一个小写字母
- 必须包含至少一个数字

### Token 机制

- Token 有效期为 24 小时
- 支持 Token 刷新（有效期不足时）
- 支持 Token 注销（加入黑名单）
- 黑名单自动清理（Token 过期后自动移除）

### 日志策略

- 正常日志仅写入文件，不输出到终端
- 错误日志同时输出到终端和文件
- 日志文件最大 10MB，保留最近 5 个文件
- 错误日志最大 5MB，保留最近 3 个文件

## 开发指南

### 启动开发环境

```bash
# 启动服务端（开发模式）
npm run dev:server

# 在另一个终端启动客户端
npm run dev:client
```

### 构建生产版本

```bash
npm run build
```

### 清理项目

```bash
npm run clean
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v2.0.0

- 重构为 TypeScript
- 新增 Token 管理机制
- 新增密码强度验证
- 新增全屏刷新终端界面
- 新增日志分级系统
- 支持 TLS 加密传输
- 新增心跳检测机制
- 优化断线重连逻辑
