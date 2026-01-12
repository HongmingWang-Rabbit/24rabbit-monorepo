/**
 * Structured Logger
 *
 * Provides consistent, structured logging across all worker components.
 * Uses JSON format in production for log aggregation compatibility.
 */

import { config } from '../config';

export interface LogContext {
  jobId?: string;
  jobType?: string;
  materialId?: string;
  brandProfileId?: string;
  organizationId?: string;
  platform?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | unknown, context?: LogContext): void;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  const configuredLevel = config.logging.level as LogLevel;
  return LOG_LEVELS[level] >= LOG_LEVELS[configuredLevel];
}

function formatError(error: Error | unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack,
    };
  }
  return { errorMessage: String(error) };
}

function createLogEntry(
  level: LogLevel,
  service: string,
  message: string,
  context?: LogContext,
  error?: Error | unknown
): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    service,
    workerId: config.workerId,
    message,
    ...context,
  };

  if (error) {
    Object.assign(entry, formatError(error));
  }

  return entry;
}

function logToConsole(entry: Record<string, unknown>): void {
  if (config.isProd) {
    // JSON format for production log aggregation
    console.log(JSON.stringify(entry));
  } else {
    // Human-readable format for development
    const { timestamp, level, service, message, ...rest } = entry;
    const contextStr = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
    const levelEmoji =
      level === 'error' ? '!' : level === 'warn' ? '?' : level === 'info' ? '+' : '.';
    console.log(`[${levelEmoji}] [${service}] ${message}${contextStr}`);
  }
}

export function createLogger(serviceName: string): Logger {
  return {
    debug(message: string, context?: LogContext): void {
      if (!shouldLog('debug')) return;
      const entry = createLogEntry('debug', serviceName, message, context);
      logToConsole(entry);
    },

    info(message: string, context?: LogContext): void {
      if (!shouldLog('info')) return;
      const entry = createLogEntry('info', serviceName, message, context);
      logToConsole(entry);
    },

    warn(message: string, context?: LogContext): void {
      if (!shouldLog('warn')) return;
      const entry = createLogEntry('warn', serviceName, message, context);
      logToConsole(entry);
    },

    error(message: string, error?: Error | unknown, context?: LogContext): void {
      if (!shouldLog('error')) return;
      const entry = createLogEntry('error', serviceName, message, context, error);
      logToConsole(entry);
    },
  };
}

// Default logger for general use
export const logger = createLogger('worker');
