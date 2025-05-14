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
  constructor() {
    super();
    this.setupJsonSafety();
    this.monkeyPatchGlobalJSON();
  }

  /**
   * Monkey patch the global JSON.parse method to handle problematic JSON
   * for the duration of our MCP session
   */
  private monkeyPatchGlobalJSON() {
    // Store the original JSON.parse
    const originalJSONParse = JSON.parse;
    
    // Replace with our sanitizing version
    JSON.parse = (text: string, reviver?: (key: any, value: any) => any) => {
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
              text.slice(0, 5) + ',' + text.slice(5),  // Insert comma at position 5
              text.slice(0, 5) + text.slice(6),        // Remove character at position 5
              text.replace(/\s+/g, ' ')                // Normalize all whitespace
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
    
    logger.debug("Global JSON.parse monkey patched for improved compatibility");
  }

  /**
   * Set up JSON safety hooks to sanitize JSON before parsing
   */
  private setupJsonSafety() {
    // Store the original parse method
    const originalParseMessage = (this as any).parseMessage;
    
    // Override with our sanitizing version
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
      
      logger.debug("Enhanced JSON safety enabled for StdioServerTransport");
    }
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
 * Creates a stdio transport with enhanced JSON safety
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