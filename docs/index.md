# 文档目录

本目录包含 LanChat CLI 项目的详细文档。

## 文档索引

- **[deployment.md](deployment.md)** - 生产环境部署指南（推荐生产环境必读）
- **[protocol.md](protocol.md)** - 通信协议详细规范
- **[architecture.md](architecture.md)** - 项目架构与设计文档
- **[architecture-responsibilities.md](architecture-responsibilities.md)** - 模块职责划分说明

## API 文档

- **[api/server-api.md](api/server-api.md)** - 服务端 API 文档
- **[api/client-api.md](api/client-api.md)** - 客户端 API 文档
- **[api/shared-api.md](api/shared-api.md)** - 共享模块 API 文档

## 快速开始

如需快速上手使用项目，请查看根目录的 **[README.md](../README.md)**。

## 生产环境部署

生产环境部署请务必参考 [deployment.md](deployment.md)，其中包含：
- 完整的安全配置说明（TLS、JWT_SECRET）
- 详细的环境变量配置
- 系统服务配置（systemd、PM2、Windows 服务）
- 运维监控与故障排查
- 备份策略
