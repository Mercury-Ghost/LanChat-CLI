import { TlsServer } from './TlsServer';
import { Database } from './Database';
import * as winston from 'winston';
import { Logger } from 'winston';
import { ensureCertificate, loadConfig, getConfig } from '../shared';
import * as path from 'path';

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

    logger.info('服务器启动成功');
  } catch (error) {
    logger.error('服务器启动失败', { error });
    process.exit(1);
  }
}

function createLogger(): Logger {
  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'logs/server.log' }),
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
