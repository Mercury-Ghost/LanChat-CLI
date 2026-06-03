const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const fsPromises = fs.promises;

async function createZip(sourceDir, outputPath) {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();
  zip.addLocalFolder(sourceDir);
  zip.writeZip(outputPath);
}

async function main() {
  try {
    const distDir = path.join(__dirname, '..', 'dist');
    const pkgDir = path.join(distDir, 'pkg');
    const rootDir = path.join(__dirname, '..');
    const licensePath = path.join(rootDir, 'LICENSE');
    const readmePath = path.join(rootDir, 'README.md');

    await fsPromises.mkdir(pkgDir, { recursive: true });

    const targets = ['server', 'client'];
    
    for (const target of targets) {
      const tempDir = path.join(pkgDir, `lanchat-${target}`);
      await fsPromises.mkdir(tempDir, { recursive: true });

      console.log(`Packaging ${target}...`);

      // 复制编译后的代码
      const sourceTargetDir = path.join(distDir, target);
      const distTargetDir = path.join(tempDir, target);
      await copyDirectory(sourceTargetDir, distTargetDir);

      // 复制 shared 目录
      const sourceSharedDir = path.join(distDir, 'shared');
      if (fs.existsSync(sourceSharedDir)) {
        const distSharedDir = path.join(tempDir, 'shared');
        await copyDirectory(sourceSharedDir, distSharedDir);
      }

      // 复制 package.json 并修改为生产版本
      const packageJson = require(path.join(rootDir, 'package.json'));
      
      const serverDependencies = {
        'argon2': packageJson.dependencies['argon2'] || packageJson.optionalDependencies['argon2'],
        'better-sqlite3': packageJson.dependencies['better-sqlite3'] || packageJson.optionalDependencies['better-sqlite3'],
        'dotenv': packageJson.dependencies['dotenv'],
        'jsonwebtoken': packageJson.dependencies['jsonwebtoken'],
        'uuid': packageJson.dependencies['uuid'],
        'winston': packageJson.dependencies['winston']
      };

      const clientDependencies = {
        'blessed': packageJson.dependencies['blessed'],
        'dotenv': packageJson.dependencies['dotenv'],
        'uuid': packageJson.dependencies['uuid']
      };

      const prodPackageJson = {
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        main: target === 'server' ? './server/index.js' : './client/index.js',
        scripts: {
          'start': target === 'server' ? 'node server/index.js' : 'node client/index.js'
        },
        dependencies: target === 'server' ? serverDependencies : clientDependencies,
        keywords: packageJson.keywords,
        author: packageJson.author,
        license: packageJson.license,
        engines: packageJson.engines
      };
      await fsPromises.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify(prodPackageJson, null, 2)
      );

      // 创建启动脚本
      const startCmdWindows = `@echo off
echo Starting LanChat ${target}...
node ${target}/index.js
pause`;
      await fsPromises.writeFile(path.join(tempDir, 'start.bat'), startCmdWindows);

      const startCmdUnix = `#!/bin/bash
echo Starting LanChat ${target}...
node ${target}/index.js`;
      await fsPromises.writeFile(path.join(tempDir, 'start.sh'), startCmdUnix);

      // 设置文件权限
      if (process.platform !== 'win32') {
        await fsPromises.chmod(path.join(tempDir, 'start.sh'), 0o755);
      }

      // 复制文档
      if (fs.existsSync(licensePath)) {
        await fsPromises.copyFile(licensePath, path.join(tempDir, 'LICENSE'));
      }

      // 创建简化版 README 用于分发版本
      const simplifiedReadme = `# LanChat CLI

基于 TCP 的局域网聊天室终端应用。

## 快速开始

### 前置要求

确保已安装 Node.js 18.0.0 或更高版本。

### 安装依赖

首次使用时，需要安装依赖：

\`\`\`bash
npm install
\`\`\`

### 启动服务端

**Windows**:
\`\`\`cmd
start.bat
\`\`\`

**macOS / Linux**:
\`\`\`bash
./start.sh
\`\`\`

### 启动客户端

**Windows**:
\`\`\`cmd
start.bat
\`\`\`

**macOS / Linux**:
\`\`\`bash
./start.sh
\`\`\`

## 配置

服务端配置可通过环境变量或同目录的 .env 文件设置：

| 环境变量 | 默认值 |
|----------|--------|
| SERVER_PORT | 9527 |
| DB_PATH | ./data/lanchat.db |
| FILES_DIR | ./files |

## 常用命令

| 命令 | 说明 |
|------|------|
| /join #<room> | 加入房间 |
| /msg <nick> <msg> | 私聊 |
| /nick <new> | 修改昵称 |
| /rooms | 列出房间 |
| /users | 列出用户 |
| /help | 显示帮助 |

## 许可证

MIT License
`;
      await fsPromises.writeFile(path.join(tempDir, 'README.md'), simplifiedReadme);

      // 创建压缩包
      const archiveName = `lanchat-${target}-bundle.zip`;
      const archivePath = path.join(distDir, archiveName);
      
      console.log(`Creating ${archiveName}...`);
      await createZip(tempDir, archivePath);

      const stats = fs.statSync(archivePath);
      console.log(`Created ${archiveName} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    }

    console.log('\nAll packages created successfully!');
    console.log(`Packages are located in: ${distDir}`);
  } catch (error) {
    console.error('Error packaging distributions:', error);
    process.exit(1);
  }
}

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

main();
