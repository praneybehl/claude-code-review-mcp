#!/usr/bin/env node
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { randomUUID } from "node:crypto";
import { PORT, HOST, getAvailableModels } from './config/index.js';
import { registerTools } from './tools/index.js';
import * as logger from './utils/logger.js';

// Server version and name
const SERVER_VERSION = "0.8.4";
const SERVER_NAME = "claude-code-review-mcp";

/**
 * Main function to start the MCP server
 */
async function main() {
  // Check if we have at least one API key
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGoogle = !!process.env.GOOGLE_API_KEY;

  if (!hasOpenAI && !hasGoogle) {
    logger.error("No API keys provided. At least one of OPENAI_API_KEY or GOOGLE_API_KEY must be set.");
    process.exit(1);
  }

  try {
    // Log startup information with version
    logger.info(`Starting ${SERVER_NAME} v${SERVER_VERSION}`);
    logger.info(`Node.js ${process.version}`);
    logger.info(`Process ID: ${process.pid}`);
    
    // Log environment variables for debugging (redacting sensitive values)
    logger.info(`Environment: PORT=${PORT}, HOST=${HOST}`);
    logger.info(`OpenAI API Key: ${process.env.OPENAI_API_KEY ? "[CONFIGURED]" : "[NOT SET]"}`);
    logger.info(`Google API Key: ${process.env.GOOGLE_API_KEY ? "[CONFIGURED]" : "[NOT SET]"}`);
    
    const availableModels = getAvailableModels();
    logger.info("Available models:", availableModels);

    // Create the MCP server instance
    const server = new McpServer({
      name: SERVER_NAME,
      version: SERVER_VERSION
    });

    // Register all tools
    registerTools(server);

    // Create Express app
    const app = express();
    app.use(express.json());

    // Store transports for each session type
    const transports = {
      streamable: {} as Record<string, StreamableHTTPServerTransport>,
      sse: {} as Record<string, SSEServerTransport>
    };

    // Health check endpoint
    app.get('/', (req, res) => {
      res.json({
        name: SERVER_NAME,
        version: SERVER_VERSION,
        status: "up",
        availableModels
      });
    });

    // Modern Streamable HTTP endpoint for MCP
    app.all('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string;
      
      if (req.method === 'POST') {
        // If there's an existing session, use it
        if (sessionId && transports.streamable[sessionId]) {
          try {
            await transports.streamable[sessionId].handleRequest(req, res, req.body);
          } catch (error) {
            logger.error("Error handling request with existing transport:", error);
            res.status(500).json({
              jsonrpc: "2.0",
              error: {
                code: -32000,
                message: `Request handling error: ${error.message}`
              },
              id: null
            });
          }
        } else {
          // Create a new transport for the session with JSON response enabled
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (newSessionId) => {
              transports.streamable[newSessionId] = transport;
            },
            enableJsonResponse: true // Enable JSON response mode by default
          });

          // Clean up transport when closed
          transport.onclose = () => {
            if (transport.sessionId) {
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
                message: `MCP server connection error: ${error.message}`
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
              message: `Error handling GET request: ${error.message}`
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
              message: `Error handling DELETE request: ${error.message}`
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
      
      res.on("close", () => {
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

    // Start listening on the specified or dynamic port
    const expressServer = app.listen(PORT, HOST, () => {
      // Get the actual port that was assigned
      const actualPort = (expressServer.address() as any).port;
      
      // Log server information
      logger.info(`MCP Server is running on http://${HOST}:${actualPort}`);
      logger.info(`Health check: http://${HOST}:${actualPort}/`);
      logger.info(`MCP endpoint: http://${HOST}:${actualPort}/mcp`);
      logger.info(`SSE endpoint: http://${HOST}:${actualPort}/sse`);
      
      // Start a proxy server that will handle JSON formatting for Claude Desktop
      import('./mcp-proxy.js').then(({ startProxy }) => {
        startProxy(actualPort, HOST).then((proxyPort) => {
          // The proxy port is what we'll expose to Claude Desktop
          logger.info(`Claude Desktop JSON-safe proxy is running on http://${HOST}:${proxyPort}`);
          logger.info(`Use this port when configuring Claude Desktop`);
          
          // Write port info to stderr so Claude Desktop can read it
          console.error(`CLAUDE_CODE_REVIEW_PORT=${proxyPort}`);
        });
      }).catch(err => {
        logger.error("Failed to start proxy server:", err);
        // Fall back to the original port if the proxy fails
        console.error(`CLAUDE_CODE_REVIEW_PORT=${actualPort}`);
      });
    });

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