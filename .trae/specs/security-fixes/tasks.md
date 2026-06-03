# LanChat-CLI 安全修复项目 - Implementation Plan

## [x] Task 1: 修复 JWT_SECRET 硬编码问题
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 修改 `src/shared/constants.ts`，移除硬编码的默认密钥
  - 开发环境自动生成随机密钥
  - 生产环境强制要求配置环境变量
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: 生产环境未设置 JWT_SECRET 时启动失败
  - `programmatic` TR-1.2: 开发环境自动生成随机密钥
  - `human-judgement` TR-1.3: 代码审查确认无硬编码密钥
- **Notes**: 使用 crypto 模块生成随机密钥

## [x] Task 2: 加强密码验证强度
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 修改 `src/server/AuthManager.ts`，注册时使用 `validatePasswordStrength`
  - 密码要求：至少8位，包含大写、小写、数字和特殊字符
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: 弱密码（<8位）注册失败
  - `programmatic` TR-2.2: 缺少大写字母注册失败
  - `programmatic` TR-2.3: 缺少小写字母注册失败
  - `programmatic` TR-2.4: 缺少数字注册失败
  - `programmatic` TR-2.5: 缺少特殊字符注册失败
- **Notes**: 需更新注册表单提示信息

## [x] Task 3: 统一认证错误信息
- **Priority**: P0
- **Depends On**: Task 1
- **Description**: 
  - 修改 `src/server/AuthManager.ts`，登录失败时返回统一错误信息
  - 避免泄露用户名是否存在
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-3.1: 用户不存在时返回"用户名或密码错误"
  - `programmatic` TR-3.2: 密码错误时返回"用户名或密码错误"
- **Notes**: 防止用户名枚举攻击（代码已符合要求）

## [x] Task 4: 清理重复的 FileTransferHandler
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 确认两个 FileTransferHandler 是不同组件（消息路由 vs 文件存储）
  - 非重复代码，无需删除
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-4.1: TypeScript 编译无错误
  - `programmatic` TR-4.2: 项目构建成功
- **Notes**: 两个文件功能不同，都是必要的

## [x] Task 5: 完善输入验证覆盖
- **Priority**: P1
- **Depends On**: Task 1
- **Description**: 
  - 在 `src/server/handlers/` 各处理器中增加输入验证
  - RoomHandler 添加房间名验证
  - UserProfileHandler 添加昵称验证
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-5.1: 无效房间名无法加入房间
  - `programmatic` TR-5.2: 无效昵称无法修改
- **Notes**: 使用现有的 validators 模块

## [x] Task 6: 数据库连接池优化
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 修改 `src/server/Database.ts`，实现数据库连接池
  - 默认池大小为5，支持轮询分配
- **Acceptance Criteria Addressed**: NFR-1
- **Test Requirements**:
  - `programmatic` TR-6.1: 数据库初始化成功
  - `programmatic` TR-6.2: 所有测试通过
- **Notes**: 提升高并发场景下的性能

## [x] Task 7: 增加单元测试覆盖
- **Priority**: P1
- **Depends On**: Tasks 1-5
- **Description**: 
  - 为 `AuthManager` 添加单元测试（9个测试用例）
  - 覆盖密码强度验证和昵称验证场景
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-7.1: 新增测试用例全部通过
  - `human-judgement` TR-7.2: 测试用例覆盖核心场景
- **Notes**: 使用 Jest mock 外部依赖

## [x] Task 8: 改进日志配置
- **Priority**: P2
- **Depends On**: None
- **Description**: 
  - 修改 `src/server/index.ts`，添加更完善的日志配置
  - 支持日志文件轮转、错误日志分离、彩色控制台输出
- **Acceptance Criteria Addressed**: NFR-1
- **Test Requirements**:
  - `programmatic` TR-8.1: 服务器启动成功
  - `human-judgement` TR-8.2: 日志格式清晰易读
- **Notes**: 提升可观测性

## [x] Task 9: 修复 config.ts 硬编码密钥
- **Priority**: P2
- **Depends On**: Task 1
- **Description**: 
  - 修改 `src/shared/config.ts`，移除硬编码测试密钥
  - 开发环境自动生成随机密钥
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-9.1: 配置加载正常
  - `human-judgement` TR-9.2: 无硬编码密钥
- **Notes**: 与 constants.ts 保持一致

## [x] Task 10: 执行回归测试
- **Priority**: P2
- **Depends On**: Tasks 1-9
- **Description**: 
  - 运行完整测试套件
  - 验证所有修复未引入新问题
- **Acceptance Criteria Addressed**: NFR-1
- **Test Requirements**:
  - `programmatic` TR-10.1: 所有测试用例通过（67个）
  - `programmatic` TR-10.2: ESLint 检查通过
- **Notes**: 确保代码符合项目规范