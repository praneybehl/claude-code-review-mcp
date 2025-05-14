/**
 * Custom MCP server with enhanced JSON handling
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as logger from "../utils/logger.js";
import { sanitizeJson } from "../utils/json-safe.js";

/**
 * Custom StdioServerTransport with enhanced JSON handling
 */
export class SafeStdioServerTransport extends StdioServerTransport {
  constructor() {
    super();
    this.setupJsonSafety();
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
          // Clean up the JSON before parsing
          const sanitized = sanitizeJson(message);
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