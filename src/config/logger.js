const path = require('path');
const fs = require('fs');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const config = require('../config');

const logDir = path.resolve(process.cwd(), config.logging.dir);

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level}]: ${stack || message}${metaStr}`;
});

const createRotateTransport = (filename, level) =>
  new DailyRotateFile({
    filename: path.join(logDir, `${filename}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    level,
  });

const logger = winston.createLogger({
  level: config.logging.level,
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), logFormat),
  transports: [
    createRotateTransport('combined', 'info'),
    createRotateTransport('error', 'error'),
    createRotateTransport('requests', 'http'),
    createRotateTransport('database', 'info'),
    createRotateTransport('auth', 'info'),
    createRotateTransport('audit', 'info'),
  ],
});

if (config.isDevelopment) {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat),
    })
  );
}

const createChildLogger = (category) => ({
  info: (message, meta) => logger.info(message, { category, ...meta }),
  warn: (message, meta) => logger.warn(message, { category, ...meta }),
  error: (message, meta) => logger.error(message, { category, ...meta }),
  debug: (message, meta) => logger.debug(message, { category, ...meta }),
});

module.exports = {
  logger,
  requestLogger: createChildLogger('request'),
  errorLogger: createChildLogger('error'),
  dbLogger: createChildLogger('database'),
  authLogger: createChildLogger('auth'),
  auditLogger: createChildLogger('audit'),
};
