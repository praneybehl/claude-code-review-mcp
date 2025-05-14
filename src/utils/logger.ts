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
 * Safe JSON stringify that handles circular references and Error objects
 */
function safeStringify(obj: any): string {
  if (!obj) return "";
  
  try {
    const seen = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack
        };
      }
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    }, 2);
  } catch (err) {
    return `[Unstringifiable Object: ${err.message}]`;
  }
}

/**
 * Log a message at debug level
 */
export function debug(message: string, data?: any): void {
  if (currentLogLevel <= LogLevel.DEBUG) {
    console.debug(`[${formatTimestamp()}] [DEBUG] ${message}`, typeof data === 'object' ? safeStringify(data) : (data || ""));
  }
}

/**
 * Log a message at info level
 */
export function info(message: string, data?: any): void {
  if (currentLogLevel <= LogLevel.INFO) {
    console.info(`[${formatTimestamp()}] [INFO] ${message}`, typeof data === 'object' ? safeStringify(data) : (data || ""));
  }
}

/**
 * Log a message at warn level
 */
export function warn(message: string, data?: any): void {
  if (currentLogLevel <= LogLevel.WARN) {
    console.warn(`[${formatTimestamp()}] [WARN] ${message}`, typeof data === 'object' ? safeStringify(data) : (data || ""));
  }
}

/**
 * Log a message at error level
 */
export function error(message: string, data?: any): void {
  if (currentLogLevel <= LogLevel.ERROR) {
    console.error(`[${formatTimestamp()}] [ERROR] ${message}`, typeof data === 'object' ? safeStringify(data) : (data || ""));
  }
}