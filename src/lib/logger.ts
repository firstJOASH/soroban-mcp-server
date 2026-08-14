import pino from 'pino';
import { config } from '../config.js';

const loggerOptions: pino.LoggerOptions = {
  level: config.LOG_LEVEL,
};

if (process.env['NODE_ENV'] !== 'production') {
  loggerOptions.transport = { target: 'pino-pretty', options: { colorize: true } };
}

export const logger = pino(loggerOptions);
