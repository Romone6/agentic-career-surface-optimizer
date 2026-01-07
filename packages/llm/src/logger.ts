import winston from 'winston';
import { getConfig } from '@ancso/core';
import path from 'path';
import fs from 'fs';

export class Logger {
  private logger: winston.Logger;

  constructor(context: string) {
    const config = getConfig();

    // Ensure log directory exists
    if (!fs.existsSync(config.LOG_DIR)) {
      fs.mkdirSync(config.LOG_DIR, { recursive: true });
    }

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(
              (info) => `
${info.timestamp} [${info.level}] [${context}]: ${info.message}` + 
              (info.stack ? `\n${info.stack}` : '')
            )
          ),
        }),
        new winston.transports.File({
          filename: path.join(config.LOG_DIR, 'combined.log'),
          level: 'info',
        }),
        new winston.transports.File({
          filename: path.join(config.LOG_DIR, 'error.log'),
          level: 'error',
        }),
      ],
    });

    // Add stack traces for errors
    this.logger.on('error', (error) => {
      console.error(`Logger error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    });
  }

  info(message: string, meta?: Record<string, any>): void {
    this.logger.info(message, meta);
  }

  error(message: string, meta?: Record<string, any>): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.logger.debug(message, meta);
  }

  verbose(message: string, meta?: Record<string, any>): void {
    this.logger.verbose(message, meta);
  }
}