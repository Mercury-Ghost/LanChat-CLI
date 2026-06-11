/**
 * Package Distribution Script for LanChat-CLI
 * Creates production-ready distribution packages following industry standards
 */

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const fsPromises = fs.promises;

// Package metadata
const PACKAGE_VERSION = require('../package.json').version;
const PACKAGE_NAME = 'lanchat';

/**
 * Create a ZIP archive from a directory
 */
async function createZip(sourceDir, outputPath) {
  const zip = new AdmZip();
  zip.addLocalFolder(sourceDir);
  zip.writeZip(outputPath);
  return fs.statSync(outputPath).size;
}

/**
 * Copy directory recursively
 */
async function copyDirectory(source, destination) {
  await fsPromises.mkdir(destination, { recursive: true });
  const entries = await fsPromises.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
    } else {
      await fsPromises.copyFile(sourcePath, destinationPath);
    }
  }
}

/**
 * Create .env.example file
 */
function createEnvExample(target) {
  if (target === 'server') {
    return `# LanChat Server Configuration
# Copy this file to .env and modify as needed

# Server port (default: 9527)
SERVER_PORT=9527

# Database path (relative to installation directory)
DB_PATH=./data/lanchat.db

# Files directory for file transfers
FILES_DIR=./files

# JWT secret for authentication (CHANGE IN PRODUCTION!)
# JWT_SECRET=your-secure-secret-here

# Log level: error, warn, info, debug
LOG_LEVEL=info
`;
  }
  return `# LanChat Client Configuration
# Copy this file to .env and modify as needed

# Server address (default: localhost)
SERVER_HOST=localhost

# Server port (default: 9527)
SERVER_PORT=9527
`;
}

/**
 * Create Windows batch file for easy startup
 */
function createBatchFile(target) {
  const entryPath = target === 'server' 
    ? 'server\\server\\index.js' 
    : 'client\\client\\index.js';
  
  return `@echo off
chcp 65001 >nul
title LanChat ${target === 'server' ? 'Server' : 'Client'}
echo Starting LanChat ${target === 'server' ? 'Server' : 'Client'}...
node ${entryPath}
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Error: Failed to start. Please ensure Node.js is installed.
    echo Download from: https://nodejs.org/
    pause
)`;
}

/**
 * Create PowerShell startup script
 */
function createPs1File(target) {
  const entryPath = target === 'server' 
    ? 'server/server/index.js' 
    : 'client/client/index.js';
  
  return `#!/usr/bin/env pwsh
# LanChat ${target === 'server' ? 'Server' : 'Client'} Startup Script

$Host.UI.RawUI.WindowTitle = "LanChat ${target === 'server' ? 'Server' : 'Client'}"

Write-Host "Starting LanChat ${target === 'server' ? 'Server' : 'Client'}..." -ForegroundColor Cyan

try {
    node ${entryPath}
}
catch {
    Write-Host ""
    Write-Host "Error: Failed to start. Please ensure Node.js is installed." -ForegroundColor Red
    Write-Host "Download from: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
}`;
}

/**
 * Create Unix shell script
 */
function createShFile(target) {
  const entryPath = target === 'server' 
    ? 'server/server/index.js' 
    : 'client/client/index.js';
  
  return `#!/bin/bash
# LanChat ${target === 'server' ? 'Server' : 'Client'} Startup Script

echo "Starting LanChat ${target === 'server' ? 'Server' : 'Client'}..."

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed."
    echo "Download from: https://nodejs.org/"
    read -p "Press Enter to exit..."
    exit 1
fi

node ${entryPath}`;
}

/**
 * Create README for distribution
 */
function createReadme(target) {
  const isServer = target === 'server';
  
  return `# LanChat CLI ${isServer ? 'Server' : 'Client'} v${PACKAGE_VERSION}

基于 TCP 的局域网聊天室终端应用。

## 系统要求

- **Node.js**: 18.0.0 或更高版本
- **操作系统**: Windows / macOS / Linux

## 快速开始

### 1. 安装依赖

\`\`\`bash
npm install
\`\`\`

### 2. 配置 (可选)

复制 \`.env.example\` 为 \`.env\` 并根据需要修改配置：

\`\`\`bash
cp .env.example .env
\`\`\`

### 3. 启动程序

**Windows**:
- 双击 \`start.bat\` 或 \`start.ps1\`
- 或在命令行运行: \`npm start\`

**macOS / Linux**:
\`\`\`bash
./start.sh
# 或
npm start
\`\`\`

## 配置说明

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
${isServer ? `| SERVER_PORT | 9527 | 服务器监听端口 |
| DB_PATH | ./data/lanchat.db | 数据库文件路径 |
| FILES_DIR | ./files | 文件传输目录 |
| JWT_SECRET | (自动生成) | JWT 密钥 (生产环境必须设置) |
| LOG_LEVEL | info | 日志级别 |` : `| SERVER_HOST | localhost | 服务器地址 |
| SERVER_PORT | 9527 | 服务器端口 |`}

## 常用命令

| 命令 | 说明 |
|------|------|
| /join #<room> | 加入房间 |
| /msg <nick> <msg> | 私聊用户 |
| /nick <new> | 修改昵称 |
| /rooms | 列出所有房间 |
| /users | 列出在线用户 |
| /help | 显示帮助信息 |
| /quit | 退出程序 |

## 目录结构

\`\`\`
${PACKAGE_NAME}-${target}/
├── ${target}/           # 主程序代码
├── shared/              # 共享模块
├── node_modules/        # 依赖包 (npm install 后生成)
├── package.json         # 包配置
├── .env.example         # 环境变量示例
├── start.bat            # Windows 启动脚本
├── start.ps1            # PowerShell 启动脚本
├── start.sh             # Unix 启动脚本
├── README.md            # 说明文档
└── LICENSE              # 许可证
\`\`\`

## 故障排除

### 无法启动
1. 确认已安装 Node.js 18+
2. 运行 \`npm install\` 安装依赖
3. 检查端口是否被占用 (服务器)

### 连接失败
1. 确认服务器已启动
2. 检查防火墙设置
3. 验证服务器地址和端口配置

## 许可证

MIT License

---
© ${new Date().getFullYear()} LanChat CLI
`;
}

/**
 * Main packaging function
 */
async function main() {
  console.log('========================================');
  console.log('  LanChat-CLI Distribution Packager');
  console.log(`  Version: ${PACKAGE_VERSION}`);
  console.log('========================================\n');

  const distDir = path.join(__dirname, '..', 'dist');
  const bundlesDir = path.join(distDir, 'bundles');
  const releasesDir = path.join(distDir, 'releases');
  const rootDir = path.join(__dirname, '..');

  // Create output directories
  await fsPromises.mkdir(bundlesDir, { recursive: true });
  await fsPromises.mkdir(releasesDir, { recursive: true });

  const targets = ['server', 'client'];
  const results = [];

  for (const target of targets) {
    console.log(`\n📦 Packaging ${target}...`);

    const bundleName = `${PACKAGE_NAME}-${target}-v${PACKAGE_VERSION}`;
    const tempDir = path.join(bundlesDir, bundleName);

    // Clean and create temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    await fsPromises.mkdir(tempDir, { recursive: true });

    // Copy compiled code
    const sourceTargetDir = path.join(distDir, target);
    if (fs.existsSync(sourceTargetDir)) {
      await copyDirectory(sourceTargetDir, path.join(tempDir, target));
    } else {
      console.warn(`  Warning: Source directory not found: ${sourceTargetDir}`);
    }

    // Copy shared directory
    const sourceSharedDir = path.join(distDir, 'shared');
    if (fs.existsSync(sourceSharedDir)) {
      await copyDirectory(sourceSharedDir, path.join(tempDir, 'shared'));
    }

    // Create package.json for distribution
    const packageJson = require(path.join(rootDir, 'package.json'));
    const dependencies = target === 'server' 
      ? {
          'argon2': packageJson.optionalDependencies['argon2'],
          'better-sqlite3': packageJson.optionalDependencies['better-sqlite3'],
          'dotenv': packageJson.dependencies['dotenv'],
          'jsonwebtoken': packageJson.dependencies['jsonwebtoken'],
          'uuid': packageJson.dependencies['uuid'],
          'winston': packageJson.dependencies['winston']
        }
      : {
          'blessed': packageJson.dependencies['blessed'],
          'dotenv': packageJson.dependencies['dotenv'],
          'uuid': packageJson.dependencies['uuid']
        };

    const prodPackageJson = {
      name: `${PACKAGE_NAME}-${target}`,
      version: PACKAGE_VERSION,
      description: `${packageJson.description} - ${target === 'server' ? 'Server' : 'Client'}`,
      main: target === 'server' 
        ? './server/server/index.js' 
        : './client/client/index.js',
      scripts: {
        start: target === 'server' 
          ? 'node server/server/index.js' 
          : 'node client/client/index.js'
      },
      dependencies,
      keywords: packageJson.keywords,
      author: packageJson.author,
      license: packageJson.license,
      engines: packageJson.engines,
      repository: packageJson.repository,
      bugs: packageJson.bugs,
      homepage: packageJson.homepage
    };

    await fsPromises.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(prodPackageJson, null, 2)
    );

    // Create startup scripts
    await fsPromises.writeFile(
      path.join(tempDir, 'start.bat'), 
      createBatchFile(target)
    );
    await fsPromises.writeFile(
      path.join(tempDir, 'start.ps1'), 
      createPs1File(target)
    );
    await fsPromises.writeFile(
      path.join(tempDir, 'start.sh'), 
      createShFile(target)
    );

    // Set Unix permissions
    if (process.platform !== 'win32') {
      await fsPromises.chmod(path.join(tempDir, 'start.sh'), 0o755);
    }

    // Create .env.example
    await fsPromises.writeFile(
      path.join(tempDir, '.env.example'), 
      createEnvExample(target)
    );

    // Create README
    await fsPromises.writeFile(
      path.join(tempDir, 'README.md'), 
      createReadme(target)
    );

    // Copy LICENSE
    const licensePath = path.join(rootDir, 'LICENSE');
    if (fs.existsSync(licensePath)) {
      await fsPromises.copyFile(licensePath, path.join(tempDir, 'LICENSE'));
    }

    // Create ZIP archive
    const archiveName = `${bundleName}.zip`;
    const archivePath = path.join(releasesDir, archiveName);
    
    console.log(`  Creating ${archiveName}...`);
    const size = await createZip(tempDir, archivePath);
    
    results.push({
      target,
      archive: archiveName,
      size: (size / 1024 / 1024).toFixed(2)
    });

    console.log(`  ✅ Created ${archiveName} (${(size / 1024 / 1024).toFixed(2)} MB)`);
  }

  // Summary
  console.log('\n========================================');
  console.log('  Packaging Complete!');
  console.log('========================================\n');

  console.log('Generated files:');
  for (const result of results) {
    console.log(`  📦 ${result.archive} (${result.size} MB)`);
  }

  console.log(`\nOutput directory: ${releasesDir}`);
  console.log('\nNext steps:');
  console.log('  1. Test the bundles by extracting and running npm install');
  console.log('  2. Test the executables (if generated)');
  console.log('  3. Upload to release page or distribute');
}

main().catch(err => {
  console.error('\n❌ Packaging failed:', err);
  process.exit(1);
});
