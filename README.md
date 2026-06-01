# LanChat CLI

局域网聊天室 CLI 程序，基于 TCP/TLS 的全屏终端聊天应用

## 项目概述

LanChat CLI 是一个基于 TCP/TLS 通信协议的局域网聊天室命令行程序，采用客户端-服务器中心化架构设计。该项目提供全屏终端用户界面，支持群聊、私聊、房间管理、文件传输、在线用户列表、用户昵称修改等完整功能。系统通过严格的密码安全机制（Argon2id）与 JWT 令牌鉴权保障通信安全，具备心跳检测、超时断开和断线重连能力，并使用 SQLite 实现消息历史与用户数据的持久化存储。

**主要应用场景：**
- 局域网内团队协作与即时通信
- 企业内网安全聊天环境
- 离线网络环境下的文件共享
- 终端用户的轻量级实时交互需求

## 快速开始

### 环境要求

- **Node.js**: 18.0.0 或更高版本（LTS 版本推荐）
- **操作系统**: Windows 10+、macOS 10.14+、Linux（主流发行版）

### 安装步骤

1. **安装依赖**
   ```bash
   npm install
   ```

2. **生成 TLS 证书**
   ```bash
   mkdir -p certs
   openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
     -keyout certs/server.key \
     -out certs/server.crt \
     -subj "/CN=LanChat"
   ```

3. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，设置 JWT_SECRET（至少 32 字符的随机字符串）
   ```

4. **编译项目**
   ```bash
   npm run build
   ```

5. **启动服务**
   ```bash
   # 启动服务端
   npm run start:server

   # 在新终端启动客户端
   npm run start:client
   ```

## 主要功能

### 安全通信
- 基于 TLS 1.2/1.3 协议实现通信信道加密
- 支持自签名 X.509 证书，具备客户端证书指纹固定机制
- 采用 Argon2id 算法进行密码哈希存储
- JWT 令牌身份认证，令牌有效期 24 小时

### 聊天功能
- 支持房间群聊与点对点私聊
- 实时在线用户列表显示
- 用户加入/离开房间系统通知
- 消息历史记录存储与查询
- 支持用户昵称实时修改

### 文件传输
- 服务器中转模式，支持大文件传输（最大 500 MB）
- 支持断点续传功能
- 传输进度实时显示
- 文件元信息持久化存储

### 终端用户界面
- 基于 blessed 框架实现全屏 TUI
- 多区域布局：聊天窗口、用户列表、输入栏、状态栏
- 支持键盘快捷键与鼠标操作
- 彩色消息渲染与系统提示

### 连接可靠性
- 心跳检测机制（15 秒间隔）
- 超时自动断开（10 秒无响应）
- 断线自动重连（指数退避策略）
- 连接状态实时显示

## 常用命令

| 命令                      | 说明                                                      |
|---------------------------|-----------------------------------------------------------|
| `/join #<room>`           | 加入或创建指定房间，并将其设为当前活动房间                |
| `/leave`                  | 离开当前房间（不允许离开默认房间 `#general`）             |
| `/rooms`                  | 列出所有房间及其在线人数                                  |
| `/msg <nick> <message>`   | 向指定用户发送私聊消息                                    |
| `/nick <newNick>`         | 请求修改当前用户昵称                                      |
| `/list`                   | 刷新当前房间在线用户列表                                  |
| `/history [count]`        | 拉取历史消息，count 默认 50，最大 200                      |
| `/sendfile <nick> <path>` | 向指定用户发送文件                                        |
| `/passwd <old> <new>`     | 修改登录密码                                              |
| `/quit`                   | 优雅断开连接并退出程序                                    |

## 开发说明

### 开发模式运行

```bash
# 开发模式运行服务端
npm run dev:server

# 开发模式运行客户端
npm run dev:client

# 类型检查
npx tsc --noEmit

# 代码检查
npm run lint
```

### 安全扫描

项目配置了 npm audit 进行依赖安全扫描：

```bash
# 运行安全扫描，检查依赖漏洞
npm run audit
# 或
npm run security

# 自动修复可修复的漏洞
npm run audit:fix
```

建议在提交代码前和安装新依赖后运行安全扫描，确保项目依赖的安全性。

### 项目结构

```
src/
├── shared/              # 共享模块
│   ├── protocol/        # 协议定义
│   ├── constants.ts     # 常量配置
│   ├── errors.ts        # 错误定义
│   └── validators.ts    # 输入校验
├── server/              # 服务端
│   ├── repositories/    # 数据访问层
│   ├── services/        # 业务逻辑层
│   └── *.ts             # 核心服务模块
├── client/              # 客户端
│   ├── components/      # TUI 组件
│   └── *.ts             # 核心客户端模块
└── p2p/                 # P2P 预留模块
```

## 文档

更多详细文档请参阅 [docs/](docs/) 目录：

- **[docs/deployment.md](docs/deployment.md)**: 生产环境部署指南（包含安全配置、环境变量说明）
- **[docs/index.md](docs/index.md)**: 文档目录与导航
- **[docs/protocol.md](docs/protocol.md)**: 通信协议详细说明
- **[docs/architecture.md](docs/architecture.md)**: 架构与设计文档
- **[docs/api/](docs/api/)**: API 文档（客户端、服务端、共享模块）

## 生产环境部署

生产环境部署请参考完整的 [部署指南](docs/deployment.md)，包含以下内容：

- 系统要求与部署前准备
- TLS 证书配置（内部 CA、Let's Encrypt、自签名）
- JWT_SECRET 安全配置
- 完整的环境变量说明
- systemd/PM2/Windows 服务配置
- 运维监控与备份策略
- 防火墙配置与故障排查

### 快速部署要点

1. **使用专用用户运行服务**，不要使用 root
2. **配置强 JWT_SECRET**（至少 32 字符随机密钥）
3. **使用受信任的 TLS 证书**，生产环境避免自签名
4. **设置正确的文件权限**（`.env` 和私钥为 600）
5. **配置自动重启**（systemd 或 PM2）
6. **设置定期备份**

## 许可证

本项目采用 MIT 许可证，详情请参阅 [LICENSE](LICENSE) 文件。

## 安全注意事项

- **证书安全**：`certs/server.key` 私钥文件严禁提交到版本库
- **配置安全**：`.env` 文件包含敏感配置，已在 `.gitignore` 中排除
- **生产部署**：生产环境务必使用内部 CA 或受信任机构签发的正式证书
- **JWT 密钥**：`JWT_SECRET` 必须设置为强随机密钥，严禁使用默认值
- **文件权限**：确保敏感文件权限正确（私钥和 .env 应为 600）

如有问题或建议，请通过项目仓库的 Issue 系统反馈。
