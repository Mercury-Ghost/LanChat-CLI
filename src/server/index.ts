import { TlsServer } from './TlsServer';
import { Database } from './Database';
import * as winston from 'winston';
import { Logger } from 'winston';
import { ensureCertificate, loadConfig, getConfig } from '../shared';
import * as path from 'path';
import * as fs from 'fs';

async function main(): Promise<void> {
  loadConfig();
  const logger = createLogger();
  const config = getConfig();

  try {
    logger.info('启动 LanChat 服务器...');

    const certDir = path.dirname(config.certPath);
    await ensureCertificate(certDir);
    logger.info('TLS 证书检查/生成完成');

    const database = new Database();
    database.init();
    logger.info('数据库初始化完成');

    const tlsServer = new TlsServer(database, logger);
    await tlsServer.start();

    logger.info('服务器启动成功', { port: config.serverPort });
  } catch (error) {
    logger.error('服务器启动失败', { error: error instanceof Error ? error.message : error });
    process.exit(1);
  }
}

function createLogger(): Logger {
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level}]: ${message}${metaStr}`;
    })
  );

  const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  );

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels: winston.config.npm.levels,
    format: fileFormat,
    transports: [
      new winston.transports.Console({
        format: consoleFormat,
        level: process.env.LOG_LEVEL || 'info',
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'server.log'),
        maxsize: 10485760,
        maxFiles: 5,
        tailable: true,
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'server-error.log'),
        level: 'error',
        maxsize: 10485760,
        maxFiles: 5,
        tailable: true,
      }),
    ],
  });
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main();
