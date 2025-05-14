#!/usr/bin/env node
/**
 * CLI entry point with enhanced JSON safety for stdio transport
 */

import { SERVER_NAME, SERVER_VERSION, validateEnv } from './config/index.js';
import { registerTools } from './tools/index.js';
import * as logger from './utils/logger.js';
import { getProviderSummary } from './utils/ai-providers.js';
import { createSafeMcpServer, connectWithSafeTransport } from './server/index.js';

/**
 * Global error handler to prevent unhandled exceptions from crashing the server
 */
process.on('uncaughtException', (error) => {
  logger.error('CRITICAL: Uncaught exception prevented server crash', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('CRITICAL: Unhandled rejection in promise', { reason, promise });
});

/**
 * Main function to start the CLI-based MCP server
 */
async function main() {
  logger.info(`Starting ${SERVER_NAME} v${SERVER_VERSION} (CLI)`);
  logger.info(`Node.js ${process.version}`);
  logger.info(`Process ID: ${process.pid}`);
  
  // Validate environment variables
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    for (const error of envErrors) {
      logger.error(error);
    }
    process.exit(1);
  }
  
  try {
    // Log provider configuration (safely - no API keys)
    const providerSummary = Object.entries(getProviderSummary()).map(([provider, info]) => {
      return `${provider}: ${info.available ? "Available" : "Not configured"} (${info.models.length} models)`;
    }).join(", ");
    
    logger.info(`Providers: ${providerSummary}`);
    
    // Create the MCP server with safe JSON handling
    const server = createSafeMcpServer({
      name: SERVER_NAME,
      version: SERVER_VERSION
    });
    
    // Register all tools
    registerTools(server);
    logger.info('MCP tools registered successfully');
    
    // Connect with safe transport
    await connectWithSafeTransport(server);
    
    // Note: The server will now handle stdin/stdout communication
    logger.info('MCP CLI server ready');
    
  } catch (error) {
    logger.error("Error starting MCP CLI server:", error);
    process.exit(1);
  }
}

// Start the server
main().catch(error => {
  logger.error("Unhandled error:", error);
  process.exit(1);
});