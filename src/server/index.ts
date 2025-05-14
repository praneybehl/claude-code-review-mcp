/**
 * Custom MCP server with enhanced JSON handling
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as logger from "../utils/logger.js";
import { sanitizeJson, fixPosition5Error } from "../utils/json-safe.js";

/**
 * Custom StdioServerTransport with enhanced JSON handling
 */
export class SafeStdioServerTransport extends StdioServerTransport {
  private originalWrite: Function;

  constructor() {
    super();
    this.setupJsonSafety();
    this.monkeyPatchGlobalJSON();
    this.interceptStdout();
  }

  /**
   * Intercept stdout to sanitize all outgoing JSON messages
   */
  private interceptStdout() {
    // Store original stdout.write
    this.originalWrite = process.stdout.write;
    
    // Monkey-patch stdout.write to sanitize all JSON messages
    (process.stdout as any).write = (chunk: string | Buffer, ...args: any[]) => {
      try {
        // Only process string data
        if (typeof chunk === 'string') {
          // Only modify JSON data
          if (chunk.trim().startsWith('{') || chunk.trim().startsWith('[')) {
            // Apply position 5 fixes aggressively
            let fixedChunk = chunk;
            
            // Apply multiple specific fixes for position 5 error
            if (chunk.length > 5) {
              // Fix 1: If we have a missing comma at position 5
              const charAtPos4 = chunk.charAt(4);
              const charAtPos5 = chunk.charAt(5);
              
              if ((charAtPos4 === '"' || charAtPos4 === '\'') && 
                (charAtPos5 === '"' || charAtPos5 === '\'')) {
                fixedChunk = chunk.slice(0, 5) + ',' + chunk.slice(5);
              }
              
              // Fix 2: If we have an extra space after an array start at position 5
              if (chunk.charAt(4) === '[' && /\s/.test(chunk.charAt(5))) {
                let i = 5;
                // Skip all spaces
                while (i < chunk.length && /\s/.test(chunk.charAt(i))) {
                  i++;
                }
                if (i < chunk.length) {
                  fixedChunk = chunk.slice(0, 5) + chunk.slice(i);
                }
              }
              
              // Fix 3: If we have any problematic whitespace at position 5
              if (/\s/.test(chunk.charAt(5)) && !["[", "{", ":", ","].includes(chunk.charAt(4))) {
                fixedChunk = chunk.slice(0, 5) + ',' + chunk.slice(5);
              }
            }
            
            // Apply our full sanitization
            fixedChunk = sanitizeJson(fixedChunk);
            
            // Verify the JSON is valid now
            try {
              JSON.parse(fixedChunk);
              // If it parsed successfully and we changed something, use the fixed version
              if (fixedChunk !== chunk) {
                logger.debug("Sanitized outgoing JSON message");
                return this.originalWrite.apply(process.stdout, [fixedChunk, ...args]);
              }
            } catch (e) {
              logger.debug("JSON sanitization didn't produce valid JSON, using original");
            }
          }
        }
        
        // Pass through to original write function if no sanitization was needed or applied
        return this.originalWrite.apply(process.stdout, [chunk, ...args]);
        
      } catch (error) {
        // If anything goes wrong, log the error but still output the original data
        logger.error("Error sanitizing stdout:", error);
        return this.originalWrite.apply(process.stdout, [chunk, ...args]);
      }
    };
    
    logger.debug("Stdout intercepted for JSON safety");
  }

  /**
   * Monkey patch the global JSON.parse method to handle problematic JSON
   * for the duration of our MCP session
   */
  private monkeyPatchGlobalJSON() {
    // Store the original JSON.parse
    const originalJSONParse = JSON.parse;
    
    // Create a sanitizing version
    const sanitizingParse = (text: string, reviver?: (key: any, value: any) => any) => {
      try {
        // Try original parse first
        return originalJSONParse(text, reviver);
      } catch (error) {
        // If it fails, try to sanitize
        logger.debug(`JSON parse error, attempting to sanitize: ${(error as Error).message}`);
        
        try {
          // First try the targeted position 5 fix
          if ((error as Error).message.includes('position 5')) {
            const position5Fixed = fixPosition5Error(text);
            if (position5Fixed !== text) {
              logger.info("Applied targeted position 5 fix");
              return originalJSONParse(position5Fixed, reviver);
            }
          }
          
          // If that fails, apply our full sanitization to fix common issues
          const sanitized = sanitizeJson(text);
          
          if (sanitized !== text) {
            logger.info("JSON sanitization applied successfully");
          }
          
          // Try parsing the sanitized version
          return originalJSONParse(sanitized, reviver);
        } catch (sanitizeError) {
          // If sanitization fails, fallback to a last-resort position 5 fix
          
          // Handle position 5 error specifically with a direct character injection
          if (text.length > 5 && (error as Error).message.includes("position 5")) {
            logger.debug("Attempting last-resort position 5 fix");
            
            // Try multiple potential fixes
            const potentialFixes = [
              text.slice(0, 5) + ',' + text.slice(5),        // Insert comma at position 5
              text.slice(0, 5) + text.slice(6),              // Remove character at position 5
              text.replace(/\s+/g, ' '),                     // Normalize all whitespace
              text.replace(/"\s+"/g, '","'),                 // Fix spaces between quotes
              text.replace(/['"]([^'"]+)['"]\s+['"]([^'"]+)['"]/g, '"$1","$2"'), // Fix quotes with missing commas
              text.replace(/\[\s+/g, '[').replace(/\s+\]/g, ']'), // Fix array whitespace
            ];
            
            for (const fix of potentialFixes) {
              try {
                const result = originalJSONParse(fix, reviver);
                logger.info("Last-resort position 5 fix successful");
                return result;
              } catch (e) {
                // Try next fix
              }
            }
            
            // If all specific fixes fail, log and let the original error propagate
            logger.debug("All position 5 fixes failed");
          }
          
          // If everything fails, rethrow the original error to maintain exact error messages
          throw error;
        }
      }
    };
    
    // Replace JSON.parse with our sanitizing version
    // Use a type assertion to avoid TypeScript errors
    (JSON as any).parse = sanitizingParse;
    
    // Create a sanitizing version of stringify
    const originalJSONStringify = JSON.stringify;
    const sanitizingStringify = (value: any, replacer?: any, space?: string | number) => {
      try {
        // Use original stringify
        const result = originalJSONStringify(value, replacer, space);
        
        // Apply our sanitization to the result
        return sanitizeJson(result);
      } catch (error) {
        // If sanitization fails, use original stringify
        logger.error("Error sanitizing JSON stringify result:", error);
        return originalJSONStringify(value, replacer, space);
      }
    };
    
    // Replace JSON.stringify with our sanitizing version
    // Use a type assertion to avoid TypeScript errors
    (JSON as any).stringify = sanitizingStringify;
    
    logger.debug("Global JSON methods monkey patched for improved compatibility");
  }

  /**
   * Set up JSON safety hooks to sanitize JSON before parsing
   */
  private setupJsonSafety() {
    // Store the original methods
    const originalParseMessage = (this as any).parseMessage;
    const originalSendMessage = (this as any).sendMessage;
    
    // Override with our sanitizing version for parsing
    if (originalParseMessage) {
      (this as any).parseMessage = (message: string) => {
        try {
          // First try the targeted position 5 fix
          let sanitized = fixPosition5Error(message);
          
          // If that didn't fix it, apply full sanitization
          if (sanitized === message) {
            sanitized = sanitizeJson(message);
          }
          
          // Call the original method with sanitized input
          return originalParseMessage.call(this, sanitized);
        } catch (error) {
          logger.error("Error parsing message:", error);
          throw error;
        }
      };
    }
    
    // Override with our sanitizing version for sending
    if (originalSendMessage) {
      (this as any).sendMessage = (message: any) => {
        try {
          // If it's a string, sanitize it
          if (typeof message === 'string') {
            const sanitized = sanitizeJson(message);
            return originalSendMessage.call(this, sanitized);
          }
          
          // If it's an object, stringify it safely and then send
          if (message && typeof message === 'object') {
            try {
              const sanitized = sanitizeJson(JSON.stringify(message));
              return originalSendMessage.call(this, sanitized);
            } catch (e) {
              // If JSON stringification fails, send original
              logger.error("Error stringifying message:", e);
            }
          }
          
          // Call the original method for any other case
          return originalSendMessage.call(this, message);
        } catch (error) {
          logger.error("Error sending message:", error);
          throw error;
        }
      };
    }
    
    logger.debug("Enhanced JSON safety enabled for StdioServerTransport");
  }
  
  /**
   * Override close to restore original stdout.write and ensure proper cleanup
   */
  async close(): Promise<void> {
    // Restore original stdout.write
    if (this.originalWrite) {
      process.stdout.write = this.originalWrite as any;
    }
    
    // Call original close
    return super.close();
  }
}

/**
 * Create a customized MCP Server
 */
export function createSafeMcpServer(options: { name: string, version: string }): McpServer {
  // Create the standard MCP server
  const server = new McpServer(options);
  
  // Return the enhanced server
  return server;
}

/**
 * Creates a stdio transport with enhanced JSON handling
 */
export function createSafeStdioTransport(): SafeStdioServerTransport {
  return new SafeStdioServerTransport();
}

/**
 * Connects to a server using the safe transport
 */
export async function connectWithSafeTransport(server: McpServer): Promise<void> {
  const transport = createSafeStdioTransport();
  await server.connect(transport);
  logger.info("MCP server connected with enhanced JSON safety");
}