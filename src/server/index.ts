import dotenv from 'dotenv';
import { TlsServer } from './TlsServer';
import { Database } from './Database';
import * as winston from 'winston';
import { Logger } from 'winston';
import { isUsingDefaultJwtSecret } from '../shared/constants';

dotenv.config();

async function main(): Promise<void> {
  const logger = createLogger();

  if (isUsingDefaultJwtSecret()) {
    logger.warn('警告: JWT_SECRET 使用默认值，生产环境中存在安全风险!');
    logger.warn('请通过环境变量 JWT_SECRET 设置安全的密钥');
    if (process.env.NODE_ENV === 'production') {
      logger.error('生产环境必须设置 JWT_SECRET 环境变量');
      process.exit(1);
    }
  }

  try {
    logger.info('启动 LanChat 服务器...');

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
