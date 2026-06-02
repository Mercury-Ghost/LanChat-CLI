# LanChat CLI

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green.svg)](https://nodejs.org/)

基于 TCP/TLS 的局域网聊天室终端应用，提供安全、高效的即时通信体验。

---

## 功能特性

### 安全通信
- TLS 1.2/1.3 加密通信信道
- 自签名 X.509 证书支持
- Argon2id 密码哈希存储
- JWT 令牌身份认证

### 聊天功能
- 房间群聊与点对点私聊
- 实时在线用户列表
- 消息历史记录
- 用户昵称修改

### 文件传输
- 服务器中转模式
- 支持大文件传输（最大 500 MB）
- 断点续传功能
- 传输进度显示

### 终端界面
- 基于 blessed 的全屏 TUI
- 多区域布局（聊天窗口、用户列表、状态栏）
- 键盘快捷键支持
- 彩色消息渲染

### 连接可靠性
- 心跳检测机制（15 秒间隔）
- 超时自动断开与重连
- 断线自动重连（指数退避策略）

---

## 快速开始

### 环境要求
- Node.js 18.0.0+（LTS 版本推荐）
- Windows 10+ / macOS 10.14+ / Linux

### 安装步骤

```bash
# 1. 安装依赖
npm install

# 2. 生成 TLS 证书（首次运行自动生成）

# 3. 编译项目
npm run build

# 4. 启动服务端
npm run start:server

# 5. 启动客户端（新终端）
npm run start:client
```

### 开发模式

```bash
# 开发模式运行服务端
npm run dev:server

# 开发模式运行客户端
npm run dev:client

# 类型检查
npm run lint
```

---

## 常用命令

在聊天界面中输入以下命令：

| 命令 | 说明 |
|------|------|
| `/join #<room>` | 加入或创建房间 |
| `/leave` | 离开当前房间 |
| `/rooms` | 列出所有房间 |
| `/msg <nick> <message>` | 发送私聊消息 |
| `/nick <newNick>` | 修改昵称 |
| `/list` | 刷新用户列表 |
| `/history [count]` | 拉取历史消息 |
| `/sendfile <nick> <path>` | 发送文件 |
| `/passwd <old> <new>` | 修改密码 |
| `/quit` | 退出程序 |
| `/help` | 显示帮助 |

---

## 项目结构

```
src/
├── shared/          # 共享模块
│   ├── protocol/    # 协议定义
│   ├── config.ts    # 配置管理
│   ├── certificate.ts # TLS 证书生成
│   ├── constants.ts # 常量配置
│   ├── errors.ts    # 错误定义
│   └── validators.ts # 输入校验
├── server/          # 服务端
│   ├── repositories/ # 数据访问层
│   ├── services/    # 业务逻辑层
│   └── *.ts         # 核心服务模块
└── client/          # 客户端
    ├── components/  # TUI 组件
    └── *.ts         # 核心客户端模块
```

---

## 配置说明

### 环境变量

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| SERVER_PORT | 9527 | 服务端口 |
| DB_PATH | ./data/lanchat.db | 数据库路径 |
| FILES_DIR | ./files | 文件存储目录 |
| CERT_PATH | ./certs/server.crt | TLS 证书路径 |
| KEY_PATH | ./certs/server.key | TLS 私钥路径 |
| JWT_SECRET | - | JWT 密钥（必填） |

### .env 文件示例

```env
SERVER_PORT=9527
JWT_SECRET=your-strong-secret-key-here-min-32-characters
DB_PATH=./data/lanchat.db
```

---

## 文档

完整文档位于 `docs/` 目录：

- [docs/architecture.md](docs/architecture.md) - 系统架构说明
- [docs/protocol.md](docs/protocol.md) - 通信协议规范
- [docs/deployment.md](docs/deployment.md) - 部署指南
- [docs/api/client-api.md](docs/api/client-api.md) - 客户端 API
- [docs/api/server-api.md](docs/api/server-api.md) - 服务端 API
- [docs/api/shared-api.md](docs/api/shared-api.md) - 共享模块 API

---

## 生产部署

请参考 [部署指南](docs/deployment.md)。

### 安全要点
1. 使用专用用户运行服务，不要使用 root
2. 配置强 JWT_SECRET（至少 32 字符）
3. 使用受信任的 TLS 证书
4. 设置正确的文件权限（私钥为 600）
5. 配置自动重启（systemd 或 PM2）
6. 设置定期备份

---

## 构建发布包

```bash
# 构建完整分发包
npm run build:dist

# 生成的文件位于 dist/ 目录
# - lanchat-server-bundle.zip
# - lanchat-client-bundle.zip
```

---

## 贡献指南

欢迎贡献代码！请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。

---

## 许可证

MIT License - 详见 [LICENSE](LICENSE)

---

## 安全注意事项

- **证书安全**：`certs/server.key` 私钥文件严禁提交到版本库
- **配置安全**：`.env` 文件包含敏感配置，已在 `.gitignore` 中排除
- **生产部署**：生产环境务必使用内部 CA 或受信任机构签发的正式证书
- **JWT 密钥**：`JWT_SECRET` 必须设置为强随机密钥，严禁使用默认值

---

**作者**: Mercury-Ghost  
**邮箱**: sbc0124@outlook.com  
**项目地址**: [https://github.com/Mercury-Ghost/LanChat-CLI](https://github.com/Mercury-Ghost/LanChat-CLI)
