/**
 * Custom MCP server with enhanced JSON handling
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as logger from "../utils/logger.js";
import { sanitizeJson, fixPosition5Error } from "../utils/json-safe.js";
import { sanitizeMcpRpc } from "../utils/stdio-patch.js";

/**
 * Custom StdioServerTransport with enhanced JSON handling
 */
export class SafeStdioServerTransport extends StdioServerTransport {
  private originalWrite: Function;
  private originalReadData: Function;

  constructor() {
    super();
    this.setupJsonSafety();
    this.patchReadBuffer();
  }

  /**
   * Patch the read buffer to catch malformed JSON before it's parsed
   */
  private patchReadBuffer() {
    // Find the readBuffer object
    const readBuffer = (this as any).readBuffer;
    if (readBuffer) {
      // Patch the readData method
      if (readBuffer.readData) {
        this.originalReadData = readBuffer.readData;
        readBuffer.readData = (data: Buffer | string) => {
          try {
            // Handle string data
            if (typeof data === 'string' && data.includes('jsonrpc')) {
              const sanitized = sanitizeMcpRpc(data);
              if (sanitized !== data) {
                logger.debug("Sanitized incoming JSON RPC message");
                return this.originalReadData.call(readBuffer, sanitized);
              }
            }
            // Handle buffer data
            else if (Buffer.isBuffer(data)) {
              const strData = data.toString('utf8');
              if (strData.includes('jsonrpc')) {
                const sanitized = sanitizeMcpRpc(strData);
                if (sanitized !== strData) {
                  logger.debug("Sanitized incoming buffer JSON RPC message");
                  return this.originalReadData.call(readBuffer, Buffer.from(sanitized, 'utf8'));
                }
              }
            }
            // Pass through to original
            return this.originalReadData.call(readBuffer, data);
          } catch (error) {
            logger.error("Error in patched readData:", error);
            return this.originalReadData.call(readBuffer, data);
          }
        };
      }

      // Patch the parsing method if available
      if (readBuffer.parseMessage) {
        const originalParseMessage = readBuffer.parseMessage;
        readBuffer.parseMessage = (message: string) => {
          try {
            if (typeof message === 'string' && message.includes('jsonrpc')) {
              const sanitized = sanitizeMcpRpc(message);
              if (sanitized !== message) {
                logger.debug("Sanitized message before parsing");
                message = sanitized;
              }
            }
            
            // Handle position 5 error specifically
            if (message.length > 5 && message.charAt(4) === '"' && message.charAt(5) === '"') {
              const fixed = message.slice(0, 5) + ',' + message.slice(5);
              try {
                return originalParseMessage.call(readBuffer, fixed);
              } catch (e) {
                // Continue with original message if fix failed
              }
            }
            
            return originalParseMessage.call(readBuffer, message);
          } catch (error) {
            logger.error("Error in patched parseMessage:", error);
            return originalParseMessage.call(readBuffer, message);
          }
        };
      }
    }
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
          // Apply MCP-specific fixes
          message = sanitizeMcpRpc(message);
          
          // Apply targeted position 5 fix
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
          // Ensure we have a proper JSON RPC 2.0 structure if it's an object
          if (message && typeof message === 'object') {
            // Ensure it has the basic fields
            if (typeof message.jsonrpc !== 'string') {
              message.jsonrpc = "2.0";
            }
            
            // Make sure method is a string if it exists
            if (message.method !== undefined && typeof message.method !== 'string') {
              message.method = String(message.method);
            }
          }
          
          // If it's a string, sanitize it
          if (typeof message === 'string') {
            // Apply MCP-specific fixes
            const sanitized = sanitizeMcpRpc(message);
            return originalSendMessage.call(this, sanitized);
          }
          
          // If it's an object, stringify it safely and then send
          if (message && typeof message === 'object') {
            try {
              const jsonStr = JSON.stringify(message);
              const sanitized = sanitizeMcpRpc(jsonStr);
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
   * Override close to ensure proper cleanup
   */
  async close(): Promise<void> {
    // Restore original methods if needed
    if (this.originalReadData) {
      const readBuffer = (this as any).readBuffer;
      if (readBuffer) {
        readBuffer.readData = this.originalReadData;
      }
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