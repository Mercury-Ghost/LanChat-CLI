# 贡献指南

感谢你有兴趣为 LanChat CLI 项目做出贡献！本文档将指导你如何参与项目开发、提交代码以及报告问题。

## 📋 目录

- [项目介绍](#项目介绍)
- [开发环境设置](#开发环境设置)
- [代码规范](#代码规范)
- [提交流程](#提交流程)
- [贡献指南](#贡献指南)
- [代码审查要求](#代码审查要求)
- [问题报告指南](#问题报告指南)
- [许可证信息](#许可证信息)

---

## 🎯 项目介绍

LanChat CLI 是一个基于 TCP/TLS 通信协议的局域网聊天室命令行程序，采用客户端-服务器中心化架构设计。该项目提供全屏终端用户界面，支持群聊、私聊、房间管理、文件传输、在线用户列表、用户昵称修改等完整功能。

### 技术栈

- **语言**: TypeScript
- **运行时**: Node.js (>= 18.0.0)
- **构建工具**: TypeScript Compiler
- **UI 框架**: Blessed (终端界面)
- **数据库**: SQLite (better-sqlite3)
- **加密**: Argon2id, JWT
- **协议**: TLS 1.2/1.3

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

---

## 🛠️ 开发环境设置

### 前置要求

- Node.js 18.0.0 或更高版本
- npm 或 yarn 包管理器
- Git

### 安装步骤

1. **Fork 并克隆仓库**

   ```bash
   # Fork 项目到你的 GitHub 账号
   # 然后克隆你的 fork
   git clone https://github.com/YOUR_USERNAME/LanChat-CLI.git
   cd LanChat-CLI
   ```

2. **安装依赖**

   ```bash
   npm install
   ```

3. **生成 TLS 证书**

   ```bash
   mkdir -p certs
   openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
     -keyout certs/server.key \
     -out certs/server.crt \
     -subj "/CN=LanChat"
   ```

4. **配置环境变量**

   ```bash
   cp .env.example .env
   # 编辑 .env 文件，设置 JWT_SECRET（至少 32 字符的随机字符串）
   ```

5. **启动开发服务器**

   ```bash
   # 开发模式运行服务端
   npm run dev:server

   # 在新终端开发模式运行客户端
   npm run dev:client
   ```

### 常用开发命令

| 命令 | 说明 |
|------|------|
| `npm run build` | 编译整个项目 |
| `npm run build:server` | 仅编译服务端 |
| `npm run build:client` | 仅编译客户端 |
| `npm run dev:server` | 开发模式运行服务端 |
| `npm run dev:client` | 开发模式运行客户端 |
| `npm run lint` | 运行代码检查 |
| `npx tsc --noEmit` | 类型检查（不生成输出） |

---

## 📝 代码规范

### TypeScript 规范

- 使用 `strict: true` 模式编译
- 优先使用接口（interface）而非类型别名（type）
- 避免使用 `any` 类型，必要时使用 `unknown`
- 所有导出函数需要显式声明返回类型

### 代码风格

项目使用 ESLint 进行代码风格检查，主要规则如下：

- **缩进**: 2 个空格
- **引号**: 单引号
- **分号**: 必须使用
- **行尾**: 不强制（兼容 Windows/macOS/Linux）

### 文件结构

- 每个文件不超过 500 行
- 一个类一个文件
- 使用 `index.ts` 作为模块出口
- 相关功能放在同一目录下

### 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 类 | PascalCase | `UserManager`, `ChatService` |
| 函数 | camelCase | `getUserById`, `sendMessage` |
| 常量 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE`, `JWT_EXPIRES_IN` |
| 变量 | camelCase | `userList`, `messageBuffer` |
| 接口 | PascalCase（以 I 开头可选） | `IUser`, `MessagePayload` |
| 类型 | PascalCase | `UserRole`, `MessageType` |

### 注释规范

- 公共 API 必须有 JSDoc 注释
- 复杂逻辑需要添加行内注释
- 避免无意义的注释
- 使用中文注释

```typescript
/**
 * 根据用户 ID 获取用户信息
 * @param userId 用户唯一标识符
 * @returns 用户信息对象，不存在时返回 null
 */
async function getUserById(userId: string): Promise<User | null> {
  // ...
}
```

### Git 提交规范

提交信息格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type 类型**:

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具链相关

**示例**:

```
feat(server): 添加用户在线状态广播功能

- 实现增量更新机制
- 优化广播性能，减少带宽占用
- 添加相关单元测试

Closes #123
```

---

## 🚀 提交流程

### 1. 创建分支

从 `main` 分支创建新的功能分支：

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

分支命名规范：
- `feature/` - 新功能
- `fix/` - Bug 修复
- `docs/` - 文档更新
- `refactor/` - 代码重构
- `perf/` - 性能优化

### 2. 开发并提交

- 确保代码通过 ESLint 检查：`npm run lint`
- 确保 TypeScript 编译通过：`npx tsc --noEmit`
- 提交你的更改

### 3. 推送并创建 PR

```bash
git push origin feature/your-feature-name
```

然后在 GitHub 上创建 Pull Request。

### Pull Request 要求

- **标题**: 清晰描述改动内容
- **描述**: 详细说明改动的目的、实现方式、影响范围
- **关联 Issue**: 如果解决了某个 Issue，请引用（如 `Closes #123`）
- **检查清单**:
  - [ ] 代码通过 ESLint 检查
  - [ ] TypeScript 编译无错误
  - [ ] 已添加必要的测试（如果适用）
  - [ ] 已更新相关文档
  - [ ] 提交信息符合规范

---

## 🤝 贡献指南

### 可以贡献的内容

- 🐛 Bug 修复
- ✨ 新功能
- 📚 文档改进
- 🎨 代码重构
- ⚡ 性能优化
- 🧪 测试补充

### 寻找任务

- 查看 [Issues](../../issues) 页面，寻找标有 `good first issue` 或 `help wanted` 的问题
- 查看项目审查报告中的待修复问题
- 提出新的功能建议

### 贡献流程

1. **讨论**: 在 Issue 中讨论你的想法，确保与项目方向一致
2. **实现**: 按照代码规范实现功能
3. **测试**: 确保改动不破坏现有功能
4. **提交**: 按照提交流程提交 PR
5. **审查**: 等待代码审查并根据反馈修改
6. **合并**: PR 通过后合并到主分支

### 首次贡献者指南

如果你是第一次贡献开源项目，可以从以下任务开始：

- 修复文档中的拼写错误
- 改进代码注释
- 修复简单的 Bug
- 添加简单的功能

---

## 🔍 代码审查要求

### 审查标准

所有 PR 必须满足以下标准才能合并：

#### 1. 功能正确性

- 代码实现了预期功能
- 没有引入新的 bug
- 边缘情况已处理

#### 2. 代码质量

- 遵循项目代码规范
- 代码清晰、可维护
- 避免过度设计
- 没有重复代码

#### 3. 性能考虑

- 没有明显的性能问题
- 避免不必要的内存分配
- 考虑大数据量场景

#### 4. 安全考虑

- 没有引入安全漏洞
- 输入验证充分
- 敏感信息处理得当

#### 5. 测试覆盖

- 核心功能有测试覆盖
- 新增功能有相应测试
- 测试通过

### 审查流程

1. **自动化检查**: CI 自动运行 lint 和类型检查
2. **代码审查**: 至少一名维护者审查
3. **反馈修改**: 根据反馈进行修改
4. **批准合并**: 审查通过后合并

### 审查反馈

- 礼貌、建设性的反馈
- 提供具体的改进建议
- 解释为什么需要修改

---

## 🐛 问题报告指南

### 提交 Issue 前

- 搜索现有 Issue，确认是否已报告过
- 确认问题在最新版本中仍然存在
- 收集尽可能多的信息

### Bug 报告模板

```markdown
## 描述问题
清晰简洁地描述问题是什么。

## 复现步骤
1. 运行 '...'
2. 输入 '....'
3. 看到错误

## 预期行为
清晰简洁地描述你期望发生什么。

## 实际行为
描述实际发生了什么。

## 环境信息
- 操作系统: [e.g. Windows 11, macOS 13, Ubuntu 22.04]
- Node.js 版本: [e.g. 18.17.0]
- 项目版本: [e.g. 1.0.0]

## 截图/日志
如果适用，添加截图或日志来帮助解释问题。

## 其他信息
添加任何其他关于问题的上下文信息。
```

### 功能请求模板

```markdown
## 功能描述
清晰简洁地描述你想要的功能。

## 问题背景
这个功能解决了什么问题？

## 解决方案
你希望如何实现？

## 替代方案
你考虑过的替代方案有哪些？

## 额外信息
添加任何其他上下文或截图。
```

---

## 📄 许可证信息

### 项目许可证

本项目采用 **MIT 许可证**。详见 [LICENSE](LICENSE) 文件。

### 贡献者许可协议

通过向本项目提交代码，你同意：

1. 你的贡献将在 MIT 许可证下发布
2. 你有权授予这些权利
3. 你的贡献是原创作品

---

## 💬 社区联系

- **问题与讨论**: [GitHub Issues](../../issues)
- **项目文档**: [docs/](docs/) 目录

再次感谢你的贡献！🎉

---

*最后更新: 2026-06-02*
