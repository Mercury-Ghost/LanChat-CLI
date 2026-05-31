# LanChat CLI

局域网聊天室 CLI 程序，基于 TCP/TLS 的全屏终端聊天应用

## 1. 项目概述

LanChat CLI 是一个基于 TCP/TLS 通信协议的局域网聊天室命令行程序，采用客户端-服务器中心化架构设计。该项目提供全屏终端用户界面，支持群聊、私聊、房间管理、文件传输、在线用户列表、用户昵称修改等完整功能。系统通过严格的密码安全机制（Argon2id）与 JWT 令牌鉴权保障通信安全，具备心跳检测、超时断开和断线重连能力，并使用 SQLite 实现消息历史与用户数据的持久化存储。架构上预留了去中心化（P2P）扩展接口，可支持未来向对等网络架构演进。

主要应用场景包括：
- 局域网内团队协作与即时通信
- 企业内网安全聊天环境
- 离线网络环境下的文件共享
- 终端用户的轻量级实时交互需求

## 2. 核心功能

### 2.1 安全通信
- 基于 TLS 1.2/1.3 协议实现通信信道加密
- 支持自签名 X.509 证书，具备客户端证书指纹固定机制
- 采用 Argon2id 算法进行密码哈希存储
- JWT 令牌身份认证，令牌有效期 24 小时

### 2.2 聊天功能
- 支持房间群聊与点对点私聊
- 实时在线用户列表显示
- 用户加入/离开房间系统通知
- 消息历史记录存储与查询
- 支持用户昵称实时修改

### 2.3 文件传输
- 服务器中转模式，支持大文件传输（最大 500 MB）
- 支持断点续传功能
- 传输进度实时显示
- 文件元信息持久化存储

### 2.4 终端用户界面
- 基于 blessed 框架实现全屏 TUI
- 多区域布局：聊天窗口、用户列表、输入栏、状态栏
- 支持键盘快捷键与鼠标操作
- 彩色消息渲染与系统提示

### 2.5 连接可靠性
- 心跳检测机制（15 秒间隔）
- 超时自动断开（10 秒无响应）
- 断线自动重连（指数退避策略）
- 连接状态实时显示

## 3. 技术架构

### 3.1 整体架构设计

项目采用客户端-服务器（C/S）架构，由以下核心部分组成：
- 服务端：负责连接管理、用户认证、消息路由、文件中转、数据持久化
- 客户端：提供终端用户界面、处理用户输入、管理连接状态
- 共享协议：定义统一的二进制通信协议与数据结构

### 3.2 技术栈选型

| 技术类别       | 技术选型                                                    |
|----------------|-------------------------------------------------------------|
| 运行时         | Node.js 18+ LTS + TypeScript 5.x                           |
| 通信底层       | TCP（Node.js `tls` 模块）                                   |
| 应用协议       | 自定义二进制协议，控制/聊天负载使用 JSON，文件传输支持二进制块 |
| 信道加密       | TLS 1.2/1.3 + 自签名 X.509 证书                            |
| 密码哈希       | Argon2id                                                    |
| 身份认证       | JWT（HMAC-SHA256 签名）                                    |
| 数据库         | SQLite（better-sqlite3 绑定，WAL 模式）                     |
| TUI 框架       | blessed                                                     |
| 日志系统       | winston                                                     |

### 3.3 模块划分

```
src/
├── shared/              # 共享模块
│   ├── protocol/        # 协议定义（消息类型、编解码、文件处理）
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

### 3.4 核心模块职责

#### 服务端模块
- **TlsServer**: 创建并管理 TLS 服务器，监听指定端口，接收新连接
- **ClientConnection**: 封装单个 TLS socket，维护接收缓冲区，按帧边界解包
- **AuthManager**: 处理注册与登录请求，执行 Argon2id 哈希与验证，签发和验证 JWT
- **UserManager**: 维护在线用户映射，确保昵称在线唯一
- **RoomManager**: 管理房间列表及每个房间的成员集合
- **MessageRouter**: 消息分发中枢，负责鉴权与路由
- **FileTransferHandler**: 管理文件传输会话，处理数据块写入、转发、续传
- **HeartbeatService**: 定时发送心跳，检测连接超时
- **Database**: SQLite 连接管理与 migrations

#### 客户端模块
- **ChatClient**: 核心客户端逻辑，连接状态机
- **TlsTransport**: 基于 TLS 的传输实现
- **AuthClient**: 登录/注册请求逻辑
- **TuiManager**: 全屏 TUI 主控制器
- **CommandHandler**: 命令解析与分发
- **FileTransferClient**: 文件发送/接收进度管理
- **LocalStore**: 本地令牌、证书指纹持久化存储

## 4. 环境要求

### 4.1 软件环境

- **Node.js**: 18.0.0 或更高版本（LTS 版本推荐）
- **npm**: 随 Node.js 安装
- **OpenSSL**: 用于生成 TLS 证书（可选，若使用自定义证书）
- **操作系统**: Windows 10+、macOS 10.14+、Linux（主流发行版）

### 4.2 硬件环境

- **CPU**: 1 核及以上
- **内存**: 最低 256 MB，推荐 512 MB
- **存储**: 最低 100 MB 可用空间
- **网络**: 局域网环境，支持 TCP/IP 通信

## 5. 安装部署步骤

### 5.1 安装依赖

```bash
npm install
```

### 5.2 生成 TLS 证书

#### 方式一：使用 OpenSSL 生成（推荐）

```bash
# 创建证书目录
mkdir -p certs

# 生成自签名证书（有效期 10 年）
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout certs/server.key \
  -out certs/server.crt \
  -subj "/CN=LanChat"
```

#### 方式二：使用现有证书

若已有证书，将证书文件放置于 `certs/` 目录下，并确保文件名与环境变量配置一致。

### 5.3 配置环境变量

```bash
# 复制示例配置文件
cp .env.example .env

# 编辑 .env 文件，设置必要配置
# 至少需要配置 JWT_SECRET 为至少 32 字符的随机字符串
```

环境变量说明：

| 变量                     | 说明                      | 默认值          |
|--------------------------|---------------------------|-----------------|
| `PORT`                   | 服务端监听端口            | `9527`          |
| `JWT_SECRET`             | JWT 签名密钥（必需）      | -               |
| `DB_PATH`                | SQLite 数据库文件路径     | `data/lanchat.db` |
| `FILES_DIR`              | 文件存储目录              | `data/files`    |
| `CERT_PATH`              | TLS 证书文件路径          | `certs/server.crt` |
| `KEY_PATH`               | TLS 私钥文件路径          | `certs/server.key` |
| `LOG_LEVEL`              | 日志级别                  | `info`          |
| `DEFAULT_HOST`           | 客户端默认连接主机        | `127.0.0.1`     |
| `DEFAULT_PORT`           | 客户端默认连接端口        | `9527`          |
| `ARGON2_TIME_COST`       | Argon2id 时间成本参数     | `4`             |
| `ARGON2_MEMORY_COST`     | Argon2id 内存成本参数     | `65536`         |
| `ARGON2_PARALLELISM`     | Argon2id 并行度参数       | `2`             |
| `HEARTBEAT_INTERVAL`     | 心跳发送间隔（毫秒）      | `15000`         |
| `HEARTBEAT_TIMEOUT`      | 心跳超时时间（毫秒）      | `10000`         |
| `CONNECTION_TIMEOUT`     | 连接超时时间（毫秒）      | `30000`         |
| `MAX_FILE_SIZE`          | 最大文件大小（字节）      | `524288000`     |
| `CHUNK_SIZE`             | 文件传输块大小（字节）    | `65536`         |
| `PROGRESS_UPDATE_INTERVAL` | 进度更新间隔（毫秒）    | `1000`          |
| `PROGRESS_UPDATE_CHUNKS` | 进度更新块数              | `10`            |
| `TEMP_FILE_RETENTION_HOURS` | 临时文件保留时间（小时）| `24`            |

### 5.4 编译项目

```bash
# 编译整个项目
npm run build

# 或分别编译服务端和客户端
npm run build:server
npm run build:client
```

### 5.5 启动服务

#### 启动服务端

```bash
npm run start:server
```

#### 启动客户端

打开新的终端窗口：

```bash
npm run start:client
```

## 6. 使用说明

### 6.1 基本操作流程

1. **首次注册**：启动客户端后，选择注册，输入昵称和密码完成账号创建
2. **登录系统**：使用已注册的账号和密码登录
3. **进入房间**：登录后自动加入默认房间 `#general`
4. **发送消息**：直接在输入栏输入文本并按回车发送
5. **使用命令**：输入以 `/` 开头的命令执行特定操作

### 6.2 客户端命令列表

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

### 6.3 快捷键与交互

- **Tab 键**：自动补全命令、房间名和在线用户昵称
- **PgUp/PgDn**：滚动聊天窗口历史
- **Esc**：清空当前输入行
- **Ctrl+C**：安全退出程序
- **鼠标滚轮**：滚动聊天窗口

### 6.4 文件传输使用示例

1. **发送文件**：
   ```
   /sendfile alice /path/to/file.txt
   ```

2. **接收文件**：收到文件请求时，状态栏会提示确认，输入 `Y` 并回车接受

## 7. 协议文档

详细的通信协议与消息类型定义请参考专门的协议文档：[protocol.md](doc/protocol.md)

协议文档包含以下内容：
- 二进制帧格式定义
- 所有消息类型的详细说明（共 28 种）
- 请求与响应负载结构
- 完整的消息示例
- 错误代码列表
- 认证说明
- 常量配置说明

## 8. 贡献指南

### 8.1 开发环境设置

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

### 8.2 代码规范

- 遵循 TypeScript 严格模式
- 使用 ESLint 进行代码风格检查
- 提交前确保通过类型检查与 lint 检查
- 为公共 API 和复杂逻辑添加注释
- 代码风格遵循 `@typescript-eslint/recommended` 规则集

#### ESLint 检查

```bash
# 运行 ESLint 检查
npm run lint

# 自动修复可修复的问题
npm run lint -- --fix
```

### 8.3 提交流程

1. Fork 项目仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 编写代码并添加相应测试
4. 确保所有测试通过 (`npm test`)
5. 确保代码风格检查通过 (`npm run lint`)
6. 确保类型检查通过 (`npx tsc --noEmit`)
7. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
8. 推送到分支 (`git push origin feature/AmazingFeature`)
9. 创建 Pull Request

### PR 检查清单

提交 Pull Request 前，请确保：

- [ ] 代码通过 TypeScript 类型检查 (`npx tsc --noEmit`)
- [ ] 代码通过 ESLint 检查 (`npm run lint`)
- [ ] 所有测试通过 (`npm test`)
- [ ] 新增代码有相应的测试覆盖
- [ ] 测试覆盖率满足要求（核心模块 >= 80%）
- [ ] 更新了相关文档（如有必要）
- [ ] 提交信息清晰描述了更改内容

### 8.4 测试

项目使用 Jest 进行测试，支持单元测试和集成测试。

#### 测试命令

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式运行测试（开发时使用）
npm run test:watch

# 运行特定测试文件
npm test -- __tests__/client/ChatClient.test.ts

# 运行特定测试用例（通过测试名称匹配）
npm test -- --testNamePattern="should connect successfully"
```

#### 测试目录结构

```
__tests__/
├── client/                    # 客户端单元测试
│   ├── AuthClient.test.ts     # 认证客户端测试
│   ├── ChatClient.test.ts     # 聊天客户端测试
│   ├── CommandHandler.test.ts # 命令处理器测试
│   ├── FileTransferClient.test.ts # 文件传输客户端测试
│   └── Transport.test.ts      # 传输层测试
├── integration/               # 集成测试
│   ├── auth.test.ts           # 认证流程集成测试
│   └── messaging.test.ts      # 消息传输集成测试
├── mocks/                     # Mock 对象
│   ├── index.ts               # Mock 导出入口
│   └── transport.mock.ts      # 传输层 Mock 实现
├── fixtures/                  # 测试数据
│   ├── index.ts               # 测试数据导出入口
│   └── test-data.ts           # 测试数据生成器
└── helpers/                   # 测试辅助工具
    ├── setup.ts               # Jest 全局设置
    ├── test-utils.ts          # 测试辅助函数
    └── index.ts               # 辅助工具导出入口
```

#### 测试覆盖率

项目要求核心模块测试覆盖率 >= 80%。运行 `npm run test:coverage` 后，覆盖率报告将生成在 `coverage/` 目录下。

覆盖率目标：
- ChatClient: >= 85%
- AuthClient: >= 90%
- CommandHandler: >= 85%
- FileTransferClient: >= 80%
- Transport: >= 80%

查看覆盖率报告：
```bash
# 生成覆盖率报告后，打开 HTML 报告
open coverage/lcov-report/index.html
```

#### 编写测试

测试文件应放置在 `__tests__/` 目录下，命名格式为 `<模块名>.test.ts`。

```typescript
// 示例：简单的单元测试
describe('MyModule', () => {
  it('should work correctly', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

使用 Mock 进行隔离测试：
```typescript
import { MockTransport } from '../mocks/transport.mock';

describe('ChatClient', () => {
  let mockTransport: MockTransport;
  let client: ChatClient;

  beforeEach(() => {
    mockTransport = new MockTransport();
    client = new ChatClient(mockTransport);
  });

  it('should connect using transport', async () => {
    await client.connect('localhost', 9527);
    expect(mockTransport.isConnected()).toBe(true);
  });
});
```

## 9. 版权信息

### 9.1 许可证

本项目采用 MIT 许可证，详情请参阅 [LICENSE](LICENSE) 文件。

### 9.2 免责声明

- 本项目为学习和研究目的开发，生产环境使用请自行评估风险
- 请妥善保管 TLS 私钥文件和 `.env` 配置文件，避免泄露敏感信息
- 生产环境建议使用内部 CA 签发的正式证书，简化客户端指纹确认流程

### 9.3 联系方式

如有问题或建议，请通过项目仓库的 Issue 系统反馈。

## 10. 安全注意事项

- **证书安全**：`certs/server.key` 私钥文件严禁提交到版本库
- **配置安全**：`.env` 文件包含敏感配置，已在 `.gitignore` 中排除
- **生产部署**：生产环境建议使用内部 CA 签发的正式证书
- **文件权限**：服务端运行目录应设置合适的文件权限，防止 `data/` 目录和证书被非授权访问
