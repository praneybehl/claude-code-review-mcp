#!/usr/bin/env node
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { randomUUID } from "node:crypto";
import { 
  PORT, 
  HOST, 
  SERVER_NAME, 
  SERVER_VERSION,
  getAvailableModels,
  getConfigSummary, 
  validateEnv
} from './config/index.js';
import { registerTools } from './tools/index.js';
import * as logger from './utils/logger.js';
import { getProviderSummary } from './utils/ai-providers.js';

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
 * Initialize MCP server with proper error handling
 */
async function initializeServer(): Promise<McpServer> {
  // Create the MCP server instance
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION
  });

  // Register all tools defined in the requirements
  try {
    registerTools(server);
    logger.info('MCP tools registered successfully');
    return server;
  } catch (error) {
    logger.error('Failed to register MCP tools:', error);
    throw new Error(`Failed to initialize server: ${(error as Error).message}`);
  }
}

/**
 * Create Express app with all routes and error handling
 */
function createExpressApp(server: McpServer) {
  // Create Express app
  const app = express();
  app.use(express.json({
    limit: '50mb' // Support larger payloads for code reviews
  }));

  // Add basic request logging
  app.use((req, res, next) => {
    const start = Date.now();
    logger.debug(`${req.method} ${req.path} started`);
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.debug(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
    });
    
    next();
  });

  // Error handling middleware for Express
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Express error:', err);
    
    // Prevent leaking stack traces to clients
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'The server encountered an unexpected condition'
    });
  });

  return app;
}

/**
 * Setup server endpoints for health checks and MCP
 */
function setupEndpoints(app: express.Application, server: McpServer) {
  // Store transports for each session type
  const transports = {
    streamable: {} as Record<string, StreamableHTTPServerTransport>,
    sse: {} as Record<string, SSEServerTransport>
  };

  // Health check endpoint
  app.get('/', (req, res) => {
    const providerSummary = getProviderSummary();
    const availableModels = getAvailableModels();
    
    res.json({
      name: SERVER_NAME,
      version: SERVER_VERSION,
      status: "up",
      providers: Object.keys(providerSummary)
        .filter(provider => providerSummary[provider].available)
        .map(provider => ({
          name: provider,
          models: providerSummary[provider].models.length
        })),
      availableModelCount: Object.keys(availableModels).length,
      uptime: Math.floor(process.uptime())
    });
  });

  // Detailed status endpoint
  app.get('/status', (req, res) => {
    res.json({
      server: getConfigSummary(),
      providers: getProviderSummary(),
      availableModels: getAvailableModels(),
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      uptime: process.uptime(),
      activeSessions: Object.keys(transports.streamable).length + Object.keys(transports.sse).length
    });
  });

  // Modern Streamable HTTP endpoint for MCP
  app.all('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string;
    
    if (req.method === 'POST') {
      // If there's an existing session, use it
      if (sessionId && transports.streamable[sessionId]) {
        try {
          logger.debug(`Using existing session: ${sessionId}`);
          await transports.streamable[sessionId].handleRequest(req, res, req.body);
        } catch (error) {
          logger.error("Error handling request with existing transport:", error);
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: `Request handling error: ${(error as Error).message}`
            },
            id: null
          });
        }
      } else {
        // Create a new transport for the session with JSON response enabled
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            logger.debug(`New session initialized: ${newSessionId}`);
            transports.streamable[newSessionId] = transport;
          },
          enableJsonResponse: true // Enable JSON response mode by default
        });

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            logger.debug(`Session closed: ${transport.sessionId}`);
            delete transports.streamable[transport.sessionId];
          }
        };

        try {
          // Connect to the MCP server
          await server.connect(transport);
          
          // Handle the request (enableJsonResponse is set in the transport constructor)
          await transport.handleRequest(req, res, req.body);
        } catch (error) {
          logger.error("Error setting up MCP connection:", error);
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: `MCP server connection error: ${(error as Error).message}`
            },
            id: null
          });
        }
      }
    } else if (req.method === 'GET') {
      // Handle GET requests for notifications
      if (!sessionId || !transports.streamable[sessionId]) {
        return res.status(400).send('Invalid or missing session ID');
      }
      
      try {
        await transports.streamable[sessionId].handleRequest(req, res);
      } catch (error) {
        logger.error("Error handling GET request:", error);
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: `Error handling GET request: ${(error as Error).message}`
          },
          id: null
        });
      }
    } else if (req.method === 'DELETE') {
      // Handle DELETE requests for session termination
      if (!sessionId || !transports.streamable[sessionId]) {
        return res.status(400).send('Invalid or missing session ID');
      }
      
      try {
        await transports.streamable[sessionId].handleRequest(req, res);
      } catch (error) {
        logger.error("Error handling DELETE request:", error);
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: `Error handling DELETE request: ${(error as Error).message}`
          },
          id: null
        });
      }
    } else {
      res.status(405).send('Method not allowed');
    }
  });

  // Legacy SSE endpoint for older clients
  app.get('/sse', async (req, res) => {
    // Create SSE transport for legacy clients
    const transport = new SSEServerTransport('/messages', res);
    transports.sse[transport.sessionId] = transport;
    logger.debug(`New SSE session initialized: ${transport.sessionId}`);
    
    res.on("close", () => {
      logger.debug(`SSE session closed: ${transport.sessionId}`);
      delete transports.sse[transport.sessionId];
    });
    
    await server.connect(transport);
  });

  // Legacy message endpoint for older clients
  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.sse[sessionId];
    if (transport) {
      await transport.handlePostMessage(req, res, req.body);
    } else {
      res.status(400).send('No transport found for sessionId');
    }
  });

  return transports;
}

/**
 * Main function to start the MCP server
 */
async function main() {
  logger.info(`Starting ${SERVER_NAME} v${SERVER_VERSION}`);
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
    
    // Initialize the MCP server
    const server = await initializeServer();
    
    // Create and configure Express app
    const app = createExpressApp(server);
    
    // Setup endpoints
    const transports = setupEndpoints(app, server);
    
    // Start listening on the specified or dynamic port
    const expressServer = app.listen(PORT, HOST, () => {
      // Get the actual port that was assigned
      const actualPort = (expressServer.address() as any).port;
      
      // Log server information
      logger.info(`MCP Server is running on http://${HOST}:${actualPort}`);
      logger.info(`Health check: http://${HOST}:${actualPort}/`);
      logger.info(`MCP endpoint: http://${HOST}:${actualPort}/mcp`);
      logger.info(`SSE endpoint: http://${HOST}:${actualPort}/sse`);
      
      // Write port info to stderr so MCP clients can read it
      console.error(`MCP_SERVER_PORT=${actualPort}`);
      console.error(`SERVER_VERSION=${SERVER_VERSION}`);
    });
    
    // Handle graceful shutdown
    const shutdownHandler = (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      // Close all transports
      Object.values(transports.streamable).forEach(transport => {
        try {
          transport.close();
        } catch (err) {
          logger.error('Error closing transport:', err);
        }
      });
      
      // Close the server
      expressServer.close(() => {
        logger.info('Server shut down successfully');
        process.exit(0);
      });
      
      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forcing shutdown after timeout');
        process.exit(1);
      }, 10000);
    };
    
    // Register shutdown handlers
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
    process.on('SIGINT', () => shutdownHandler('SIGINT'));

  } catch (error) {
    logger.error("Error starting MCP server:", error);
    process.exit(1);
  }
}

// Start the server
main().catch(error => {
  logger.error("Unhandled error:", error);
  process.exit(1);
});