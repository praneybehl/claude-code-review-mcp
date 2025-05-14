/**
 * Simple logger utility for the MCP server
 */

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Current log level set by environment variable or default
const currentLogLevel = process.env.LOG_LEVEL 
  ? parseInt(process.env.LOG_LEVEL, 10) 
  : LogLevel.INFO;

/**
 * Format the current timestamp for logging
 */
function formatTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Log a message at debug level
 */
export function debug(message: string, data?: any): void {
  if (currentLogLevel <= LogLevel.DEBUG) {
    console.debug(`[${formatTimestamp()}] [DEBUG] ${message}`, data ? data : "");
  }
}

/**
 * Log a message at info level
 */
export function info(message: string, data?: any): void {
  if (currentLogLevel <= LogLevel.INFO) {
    console.info(`[${formatTimestamp()}] [INFO] ${message}`, data ? data : "");
  }
}

/**
 * Log a message at warn level
 */
export function warn(message: string, data?: any): void {
  if (currentLogLevel <= LogLevel.WARN) {
    console.warn(`[${formatTimestamp()}] [WARN] ${message}`, data ? data : "");
  }
}

/**
 * Log a message at error level
 */
export function error(message: string, data?: any): void {
  if (currentLogLevel <= LogLevel.ERROR) {
    console.error(`[${formatTimestamp()}] [ERROR] ${message}`, data ? data : "");
  }
}