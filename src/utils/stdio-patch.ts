/**
 * This module provides patches for the MCP SDK StdioTransport 
 * to fix JSON serialization issues, especially the position 5 error
 */

import * as logger from './logger.js';
import { sanitizeJson } from './json-safe.js';

/**
 * Apply patches to process.stdout and process.stdin to sanitize JSON
 * before it's sent or received
 */
export function patchStdio(): () => void {
  // Store original methods
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  // Patch stdout.write to sanitize all outgoing JSON
  (process.stdout as any).write = function(chunk: string | Buffer, ...args: any[]): boolean {
    try {
      if (typeof chunk === 'string' && (chunk.trim().startsWith('{') || chunk.trim().startsWith('['))) {
        // Very direct position 5 fix for most common case
        if (chunk.length > 5 && chunk.charAt(5) === '"' && chunk.charAt(4) === '"') {
          const fixed = chunk.slice(0, 5) + ',' + chunk.slice(5);
          return originalStdoutWrite.apply(process.stdout, [fixed, ...args]);
        }
        
        // More general sanitization
        const sanitized = sanitizeJson(chunk);
        if (sanitized !== chunk) {
          logger.debug("Sanitized outgoing JSON message");
          return originalStdoutWrite.apply(process.stdout, [sanitized, ...args]);
        }
      }
      return originalStdoutWrite.apply(process.stdout, [chunk, ...args]);
    } catch (error) {
      logger.error("Error sanitizing stdout:", error);
      return originalStdoutWrite.apply(process.stdout, [chunk, ...args]);
    }
  };

  // Also patch stderr, as some systems might use it
  (process.stderr as any).write = function(chunk: string | Buffer, ...args: any[]): boolean {
    try {
      if (typeof chunk === 'string' && (chunk.trim().startsWith('{') || chunk.trim().startsWith('['))) {
        // Very direct position 5 fix for most common case
        if (chunk.length > 5 && chunk.charAt(5) === '"' && chunk.charAt(4) === '"') {
          const fixed = chunk.slice(0, 5) + ',' + chunk.slice(5);
          return originalStderrWrite.apply(process.stderr, [fixed, ...args]);
        }
        
        // More general sanitization
        const sanitized = sanitizeJson(chunk);
        if (sanitized !== chunk) {
          logger.debug("Sanitized stderr JSON message");
          return originalStderrWrite.apply(process.stderr, [sanitized, ...args]);
        }
      }
      return originalStderrWrite.apply(process.stderr, [chunk, ...args]);
    } catch (error) {
      logger.error("Error sanitizing stderr:", error);
      return originalStderrWrite.apply(process.stderr, [chunk, ...args]);
    }
  };

  // Return a function to restore original methods
  return () => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  };
}

/**
 * Create a patched JSON object with extra safety measures
 */
export function createSafeJSON(): { 
  parse: typeof JSON.parse, 
  stringify: typeof JSON.stringify,
  restore: () => void
} {
  // Store original methods
  const originalJSONParse = JSON.parse;
  const originalJSONStringify = JSON.stringify;

  // Create safe parse
  const safeParse = (text: string, ...args: any[]) => {
    try {
      // First try with original
      return originalJSONParse(text, ...args);
    } catch (error) {
      logger.debug(`JSON parse error, attempting direct fixes: ${(error as Error).message}`);

      // Position 5 direct fix
      if ((error as Error).message.includes('position 5') && text.length > 5) {
        try {
          // Insert comma at position 5
          const fixedText = text.slice(0, 5) + ',' + text.slice(5);
          return originalJSONParse(fixedText, ...args);
        } catch (e) {
          // Try another common pattern - remove character at position 5
          try {
            const fixedText = text.slice(0, 5) + text.slice(6);
            return originalJSONParse(fixedText, ...args);
          } catch (e2) {
            // Try full sanitization
            try {
              const sanitized = sanitizeJson(text);
              return originalJSONParse(sanitized, ...args);
            } catch (e3) {
              // Re-throw original error if all else fails
              throw error;
            }
          }
        }
      }

      // Try sanitize for non-position 5 errors
      try {
        const sanitized = sanitizeJson(text);
        return originalJSONParse(sanitized, ...args);
      } catch (e) {
        // Re-throw original error if all else fails
        throw error;
      }
    }
  };

  // Create safe stringify
  const safeStringify = (value: any, ...args: any[]) => {
    try {
      // Get original stringified version
      const json = originalJSONStringify(value, ...args);
      
      // Ensure it's properly formatted at position 5 (common issue point)
      if (json.length > 5 && json.charAt(5) === '"' && json.charAt(4) === '"') {
        return json.slice(0, 5) + ',' + json.slice(5);
      }
      
      // Apply sanitization to catch other issues
      return sanitizeJson(json);
    } catch (error) {
      logger.error("Error in JSON stringify:", error);
      // Try a more permissive approach for error cases
      try {
        return originalJSONStringify(
          value, 
          (key, val) => {
            // Convert problematic types to strings
            if (val instanceof Error) {
              return {
                name: val.name,
                message: val.message,
                stack: val.stack
              };
            }
            if (typeof val === 'function') {
              return '[Function]';
            }
            if (val instanceof RegExp) {
              return val.toString();
            }
            // Handle circular references
            const seen = new Set();
            if (typeof val === 'object' && val !== null) {
              if (seen.has(val)) {
                return '[Circular Reference]';
              }
              seen.add(val);
            }
            return val;
          }, 
          ...args.slice(1)
        );
      } catch (e) {
        // Last resort - stringify what we can
        return `{"error":"Failed to stringify object: ${(error as Error).message}"}`;
      }
    }
  };

  // Create restore function
  const restore = () => {
    JSON.parse = originalJSONParse;
    JSON.stringify = originalJSONStringify;
  };

  // Return safe JSON object
  return {
    parse: safeParse,
    stringify: safeStringify,
    restore
  };
}

/**
 * Apply MCP-specific JSON RPC format fixes
 * 
 * @param json Input JSON string
 * @returns Sanitized JSON string
 */
export function sanitizeMcpRpc(json: string): string {
  try {
    // Only process likely JSON content
    if (!json || !json.trim().startsWith('{')) {
      return json;
    }
    
    let result = json;
    
    // Fix position 5 error where opening array is malformed
    // This is usually found in formats like:
    // {"jsonrpc":"2.0""method":"initialize", ...}
    // Should be:
    // {"jsonrpc":"2.0","method":"initialize", ...}
    const rpcFormat = /"jsonrpc"\s*:\s*"2.0""\s*method"/;
    if (rpcFormat.test(result)) {
      result = result.replace(/"jsonrpc"\s*:\s*"2.0""\s*method"/, '"jsonrpc":"2.0","method"');
    }
    
    // Fix for missing comma after version
    const versionFormat = /"jsonrpc"\s*:\s*"2.0"\s+"/;
    if (versionFormat.test(result)) {
      result = result.replace(versionFormat, '"jsonrpc":"2.0","');
    }
    
    // Apply general JSON sanitization if we modified the content
    if (result !== json) {
      return sanitizeJson(result);
    }
    
    return result;
  } catch (error) {
    logger.error("Error sanitizing MCP RPC message:", error);
    return json;
  }
}

/**
 * Initialize all JSON safety features
 * 
 * @returns A function to restore original functionality
 */
export function initializeJsonSafety(): () => void {
  // Patch stdio
  const restoreStdio = patchStdio();
  
  // Replace JSON global methods
  const safeJSON = createSafeJSON();
  (JSON as any).parse = safeJSON.parse;
  (JSON as any).stringify = safeJSON.stringify;
  
  // Return a function to restore everything
  return () => {
    restoreStdio();
    safeJSON.restore();
  };
}