# LanChat CLI 生产环境部署指南

本文档详细介绍了如何在生产环境中部署和配置 LanChat CLI 服务器。

## 目录
- [系统要求](#系统要求)
- [部署前准备](#部署前准备)
- [安全配置](#安全配置)
- [部署步骤](#部署步骤)
- [环境变量配置](#环境变量配置)
- [系统服务配置](#系统服务配置)
- [运维监控](#运维监控)
- [故障排查](#故障排查)

## 系统要求

### 硬件要求
- **CPU**: 1 核心以上（推荐 2 核心）
- **内存**: 512MB 以上（推荐 1GB）
- **存储**: 至少 1GB 可用空间（根据消息历史和文件传输需求调整）
- **网络**: 100Mbps 以上局域网连接

### 软件要求
- **操作系统**:
  - Linux（推荐 Debian 12+、Ubuntu 22.04+、CentOS 8+）
  - Windows Server 2019+
  - macOS 12+
- **Node.js**: 18.0.0 或更高版本（LTS 版本推荐）
- **OpenSSL**: 用于生成证书（可选，可使用其他工具）

## 部署前准备

### 1. 创建专用用户（推荐）

**Linux/macOS**:
```bash
# 创建专用用户
sudo useradd -r -s /bin/false lanchat

# 创建应用目录
sudo mkdir -p /opt/lanchat
sudo chown lanchat:lanchat /opt/lanchat
```

**Windows**:
```powershell
# 创建专用服务账户（可选）
# 使用组策略或本地用户管理创建
```

### 2. 安装 Node.js

**Linux (Ubuntu/Debian)**:
```bash
# 使用 NodeSource 仓库安装
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

**Linux (CentOS/RHEL)**:
```bash
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo yum install -y nodejs
```

**Windows/macOS**:
从 [Node.js 官网](https://nodejs.org/) 下载 LTS 版本安装。

### 3. 获取应用代码

```bash
# 克隆或复制项目到服务器
cd /opt/lanchat
sudo -u lanchat git clone <repository-url> .
# 或直接上传文件
```

### 4. 安装依赖

```bash
cd /opt/lanchat
sudo -u lanchat npm install --omit=dev
```

## 安全配置

### 1. TLS 证书配置

生产环境强烈建议使用受信任的证书，而非自签名证书。

#### 方案 A：使用内部 CA 签发证书（推荐用于企业内网）

```bash
# 创建证书目录
sudo -u lanchat mkdir -p /opt/lanchat/certs
cd /opt/lanchat/certs

# 生成 CA 私钥（仅一次）
openssl genrsa -out ca.key 4096

# 生成 CA 证书
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -out ca.crt \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=YourCompany/OU=IT/CN=LanChat CA"

# 生成服务器私钥
sudo -u lanchat openssl genrsa -out server.key 2048

# 生成证书签名请求 (CSR)
sudo -u lanchat openssl req -new -key server.key -out server.csr \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=YourCompany/OU=IT/CN=lanchat.yourcompany.com"

# 创建配置文件
cat > server.conf << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names
[alt_names]
DNS.1 = lanchat.yourcompany.com
IP.1 = 192.168.1.100
EOF

# 使用 CA 签发服务器证书
sudo -u lanchat openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out server.crt -days 365 -sha256 -extfile server.conf

# 设置正确的权限
sudo chown -R lanchat:lanchat /opt/lanchat/certs
sudo chmod 600 /opt/lanchat/certs/server.key
sudo chmod 644 /opt/lanchat/certs/server.crt
```

#### 方案 B：使用自签名证书（仅用于测试）

```bash
sudo -u lanchat mkdir -p /opt/lanchat/certs
cd /opt/lanchat/certs

sudo -u lanchat openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout server.key \
  -out server.crt \
  -subj "/C=CN/ST=State/L=City/O=Organization/CN=lanchat-server"

sudo chmod 600 server.key
```

#### 方案 C：使用 Let's Encrypt 证书（公网部署）

如果服务器有公网域名，可使用 Let's Encrypt 免费证书：

```bash
# 安装 certbot
sudo apt-get install certbot  # Debian/Ubuntu
# 或
sudo yum install certbot      # CentOS/RHEL

# 获取证书
sudo certbot certonly --standalone -d lanchat.yourdomain.com

# 复制证书到应用目录
sudo cp /etc/letsencrypt/live/lanchat.yourdomain.com/fullchain.pem /opt/lanchat/certs/server.crt
sudo cp /etc/letsencrypt/live/lanchat.yourdomain.com/privkey.pem /opt/lanchat/certs/server.key
sudo chown lanchat:lanchat /opt/lanchat/certs/*
```

### 2. JWT_SECRET 配置

生成强密钥作为 JWT_SECRET，至少 32 字符：

```bash
# Linux/macOS
sudo -u lanchat openssl rand -base64 64

# Windows PowerShell
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64))
```

保存此密钥，后续配置环境变量使用。

### 3. 文件权限设置

```bash
# 设置应用目录权限
sudo chown -R lanchat:lanchat /opt/lanchat
sudo chmod 750 /opt/lanchat

# 创建数据目录
sudo -u lanchat mkdir -p /opt/lanchat/data
sudo chmod 700 /opt/lanchat/data

# 创建日志目录
sudo -u lanchat mkdir -p /opt/lanchat/logs
sudo chmod 700 /opt/lanchat/logs

# 确保敏感文件保护
sudo chmod 600 /opt/lanchat/.env
sudo chmod 600 /opt/lanchat/certs/server.key
```

## 部署步骤

### 1. 编译项目

```bash
cd /opt/lanchat
sudo -u lanchat npm run build
```

### 2. 配置环境变量

```bash
# 复制示例配置
sudo -u lanchat cp .env.example .env

# 编辑配置文件
sudo -u lanchat nano .env
```

根据实际需求修改配置（详见[环境变量配置](#环境变量配置)章节）。

### 3. 初始化数据库

首次启动会自动创建数据库文件，无需手动初始化。

### 4. 测试启动

```bash
# 测试运行
cd /opt/lanchat
sudo -u lanchat npm run start:server
```

确认无错误后，按 Ctrl+C 停止。

## 环境变量配置

### 服务端配置

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `PORT` | 否 | 9527 | 服务器监听端口 |
| `JWT_SECRET` | 是 | - | JWT 签名密钥（至少 32 字符，生产环境必须修改） |
| `DB_PATH` | 否 | data/lanchat.db | SQLite 数据库文件路径 |
| `FILES_DIR` | 否 | data/files | 文件存储目录 |
| `CERT_PATH` | 否 | certs/server.crt | TLS 证书文件路径 |
| `KEY_PATH` | 否 | certs/server.key | TLS 私钥文件路径 |
| `LOG_LEVEL` | 否 | info | 日志级别：error, warn, info, verbose, debug |
| `MAX_CONNECTIONS` | 否 | 100 | 最大并发连接数 |

### 密码哈希配置（Argon2id）

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `ARGON2_TIME_COST` | 4 | 迭代次数（时间成本），值越大越安全但越慢 |
| `ARGON2_MEMORY_COST` | 65536 | 内存使用量（KB），值越大越安全 |
| `ARGON2_PARALLELISM` | 2 | 并行线程数 |

生产环境建议根据服务器性能调整：
- 高安全：`ARGON2_TIME_COST=6`, `ARGON2_MEMORY_COST=131072`
- 平衡性能：`ARGON2_TIME_COST=4`, `ARGON2_MEMORY_COST=65536`

### 心跳配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `HEARTBEAT_INTERVAL` | 15000 | 心跳发送间隔（毫秒） |
| `HEARTBEAT_TIMEOUT` | 10000 | 心跳超时时间（毫秒） |
| `CONNECTION_TIMEOUT` | 30000 | 连接超时时间（毫秒） |

### 文件传输配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `MAX_FILE_SIZE` | 524288000 | 最大文件大小（字节，默认 500MB） |
| `CHUNK_SIZE` | 65536 | 文件传输块大小（字节） |
| `TEMP_FILE_RETENTION_HOURS` | 24 | 临时文件保留时间（小时） |
| `MAX_USER_TRANSFERS` | 3 | 单个用户最大并发传输数 |
| `MAX_GLOBAL_TRANSFERS` | 20 | 全局最大并发传输数 |

### 客户端配置（可选）

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `DEFAULT_HOST` | 127.0.0.1 | 默认服务器地址 |
| `DEFAULT_PORT` | 9527 | 默认服务器端口 |

## 系统服务配置

### Linux (systemd)

创建服务文件 `/etc/systemd/system/lanchat.service`：

```ini
[Unit]
Description=LanChat CLI Server
After=network.target

[Service]
Type=simple
User=lanchat
Group=lanchat
WorkingDirectory=/opt/lanchat
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/lanchat/dist/server/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=lanchat

# 安全设置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/lanchat/data /opt/lanchat/certs /opt/lanchat/logs
ReadOnlyPaths=/opt/lanchat

[Install]
WantedBy=multi-user.target
```

启用并启动服务：

```bash
# 重载 systemd 配置
sudo systemctl daemon-reload

# 启用开机自启
sudo systemctl enable lanchat

# 启动服务
sudo systemctl start lanchat

# 查看状态
sudo systemctl status lanchat

# 查看日志
sudo journalctl -u lanchat -f
```

### Windows (服务)

使用 [node-windows](https://github.com/coreybutler/node-windows) 或 NSSM 安装为 Windows 服务：

```powershell
# 安装 NSSM (Non-Sucking Service Manager)
# 下载: https://nssm.cc/download

# 使用 NSSM 安装服务
nssm install LanChat "C:\Program Files\nodejs\node.exe"
nssm set LanChat AppDirectory "D:\lanchat"
nssm set LanChat AppParameters "dist\server\index.js"
nssm set LanChat DisplayName "LanChat Server"
nssm set LanChat Description "LanChat CLI 聊天服务器"
nssm set LanChat Start SERVICE_AUTO_START

# 启动服务
nssm start LanChat
```

### 使用 PM2 (跨平台)

PM2 是 Node.js 应用的进程管理器，适用于生产环境：

```bash
# 全局安装 PM2
sudo npm install -g pm2

# 启动应用
cd /opt/lanchat
sudo -u lanchat pm2 start dist/server/index.js --name lanchat

# 设置开机自启
sudo -u lanchat pm2 startup
sudo -u lanchat pm2 save

# 常用命令
sudo -u lanchat pm2 status      # 查看状态
sudo -u lanchat pm2 logs lanchat  # 查看日志
sudo -u lanchat pm2 restart lanchat  # 重启
sudo -u lanchat pm2 stop lanchat    # 停止
```

## 运维监控

### 日志管理

日志同时输出到控制台和 `logs/server.log` 文件。建议配置日志轮转：

**确保日志目录存在**：
```bash
sudo -u lanchat mkdir -p /opt/lanchat/logs
```

**systemd journal 配置**（`/etc/systemd/journald.conf`）：
```ini
SystemMaxUse=500M
SystemMaxFileSize=50M
RuntimeMaxUse=100M
```

**logrotate 配置**（`/etc/logrotate.d/lanchat`）：
```
/opt/lanchat/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 lanchat lanchat
    sharedscripts
    postrotate
        systemctl reload lanchat > /dev/null 2>&1 || true
    endscript
}
```

### 健康检查

可以通过检查端口监听状态进行监控：

```bash
# 检查端口是否监听
netstat -tlnp | grep 9527
# 或
ss -tlnp | grep 9527

# 使用 curl 简单测试（需要额外实现健康检查接口）
```

### 备份策略

定期备份数据库和文件：

```bash
#!/bin/bash
# backup.sh - 每日备份脚本

BACKUP_DIR="/var/backups/lanchat"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 备份数据库
cp /opt/lanchat/data/lanchat.db $BACKUP_DIR/lanchat_$DATE.db

# 备份文件（可选）
# tar -czf $BACKUP_DIR/files_$DATE.tar.gz /opt/lanchat/data/files

# 保留最近 30 天的备份
find $BACKUP_DIR -name "lanchat_*.db" -mtime +30 -delete
find $BACKUP_DIR -name "files_*.tar.gz" -mtime +30 -delete
```

添加到 crontab：
```bash
sudo -u lanchat crontab -e
# 每天凌晨 2 点备份
0 2 * * * /opt/lanchat/scripts/backup.sh
```

## 防火墙配置

### Linux (ufw)

```bash
# 允许 LanChat 端口
sudo ufw allow 9527/tcp

# 或指定来源 IP（更安全）
sudo ufw allow from 192.168.1.0/24 to any port 9527/tcp
```

### Linux (iptables)

```bash
sudo iptables -A INPUT -p tcp --dport 9527 -s 192.168.1.0/24 -j ACCEPT
sudo netfilter-persistent save
```

### Windows 防火墙

```powershell
New-NetFirewallRule -DisplayName "LanChat Server" -Direction Inbound -LocalPort 9527 -Protocol TCP -Action Allow
```

## 故障排查

### 服务无法启动

1. 检查日志：
```bash
sudo journalctl -u lanchat -n 50
```

2. 检查端口占用：
```bash
sudo netstat -tlnp | grep 9527
```

3. 检查文件权限：
```bash
ls -la /opt/lanchat/
ls -la /opt/lanchat/certs/
ls -la /opt/lanchat/data/
```

### TLS 连接失败

1. 验证证书有效性：
```bash
openssl x509 -in /opt/lanchat/certs/server.crt -text -noout
```

2. 测试 TLS 连接：
```bash
openssl s_client -connect localhost:9527
```

### 认证问题

1. 检查 JWT_SECRET 是否已正确配置
2. 确认 .env 文件权限为 600
3. 验证 JWT_SECRET 长度至少 32 字符

### 性能问题

1. 检查内存使用：
```bash
ps aux | grep lanchat
```

2. 调整 Argon2 参数降低资源消耗
3. 检查并发连接数，考虑调整 MAX_CONNECTIONS

## 更新部署

```bash
# 1. 停止服务
sudo systemctl stop lanchat

# 2. 备份当前版本
sudo -u lanchat cp -r /opt/lanchat /opt/lanchat.backup

# 3. 更新代码
cd /opt/lanchat
sudo -u lanchat git pull

# 4. 更新依赖
sudo -u lanchat npm install --omit=dev

# 5. 重新编译
sudo -u lanchat npm run build

# 6. 启动服务
sudo systemctl start lanchat

# 7. 验证
sudo systemctl status lanchat
```

## 安全检查清单

部署前请确认：

- [ ] 使用受信任的 CA 签发的证书（而非自签名）
- [ ] JWT_SECRET 已更换为强随机密钥（至少 32 字符）
- [ ] .env 文件权限为 600
- [ ] server.key 私钥权限为 600
- [ ] 服务使用非 root 专用用户运行
- [ ] 已创建 data、certs、logs 目录并设置正确权限
- [ ] 防火墙仅允许信任的网络访问
- [ ] 已配置定期备份
- [ ] 日志已配置轮转
- [ ] Argon2 参数适合服务器性能
- [ ] 已启用 systemd/PM2 的自动重启

## 联系支持

如遇到问题，请查看项目仓库的 Issue 系统或提交新 Issue。
