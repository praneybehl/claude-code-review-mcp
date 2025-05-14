#!/usr/bin/env node
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "node:crypto";
import { PORT, HOST, getAvailableModels } from './config/index.js';
import { registerTools } from './tools/index.js';
import * as logger from './utils/logger.js';
import { createStreamResponse } from './utils/transport-helpers.js';

// Server version and name
const SERVER_VERSION = "0.5.5";
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
    // Log startup information
    logger.info(`Starting ${SERVER_NAME} v${SERVER_VERSION}`);
    const availableModels = getAvailableModels();
    logger.info("Available models:", availableModels);

    // Create Hono app
    const app = new Hono();

    // Map to store transports by session ID
    const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

    // Handle POST requests for client-to-server communication
    app.post('/mcp', async (c) => {
      const req = c.req.raw;
      const { readable, writable } = new TransformStream();
      const response = new Response(readable);
      
      // Check for existing session ID
      const sessionId = req.headers.get('mcp-session-id');
      let transport: StreamableHTTPServerTransport;
      

      if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId];
        
        try {
          // Handle the request
          const body = await req.json();
          const streamResponse = createStreamResponse(writable);
          // @ts-ignore: TypeScript doesn't understand our StreamableHTTPServerTransport needs
          await transport.handleRequest(req as any, streamResponse as any, body);
        } catch (reqError) {
          logger.error("Error handling existing session request:", reqError);
          // Close the writer with error info so the client gets a response
          const writer = writable.getWriter();
          writer.write(new TextEncoder().encode(JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: `Request handling error: ${reqError.message}`
            },
            id: null
          })));
          writer.close();
        }
        
        return response;
      } else {
        // New transport for initialization request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            // Store the transport by session ID
            transports[newSessionId] = transport;
          }
        });

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
          }
        };

        // Create MCP server
        const server = new McpServer({
          name: SERVER_NAME,
          version: SERVER_VERSION
        });

        // Register all tools
        registerTools(server);

        try {
          // Connect to the MCP server
          await server.connect(transport);
          
          // Handle the request
          const body = await req.json();
          const streamResponse = createStreamResponse(writable);
          // @ts-ignore: TypeScript doesn't understand our StreamableHTTPServerTransport needs
          await transport.handleRequest(req as any, streamResponse as any, body);
        } catch (connError) {
          logger.error("Error in MCP connection or request handling:", connError);
          // Close the writer with error info so the client gets a response
          const writer = writable.getWriter();
          writer.write(new TextEncoder().encode(JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: `MCP server connection error: ${connError.message}`
            },
            id: null
          })));
          writer.close();
        }
        
        return response;
      }
    });

    // Handle GET requests for server-to-client notifications
    app.get('/mcp', async (c) => {
      const req = c.req.raw;
      const { readable, writable } = new TransformStream();
      const response = new Response(readable);
      
      const sessionId = req.headers.get('mcp-session-id');
      if (!sessionId || !transports[sessionId]) {
        return c.text('Invalid or missing session ID', 400);
      }
      
      const transport = transports[sessionId];
      const streamResponse = createStreamResponse(writable);
      // @ts-ignore: TypeScript doesn't understand our StreamableHTTPServerTransport needs
      await transport.handleRequest(req as any, streamResponse as any);
      
      return response;
    });

    // Handle DELETE requests for session termination
    app.delete('/mcp', async (c) => {
      const req = c.req.raw;
      const { readable, writable } = new TransformStream();
      const response = new Response(readable);
      
      const sessionId = req.headers.get('mcp-session-id');
      if (!sessionId || !transports[sessionId]) {
        return c.text('Invalid or missing session ID', 400);
      }
      
      const transport = transports[sessionId];
      const streamResponse = createStreamResponse(writable);
      // @ts-ignore: TypeScript doesn't understand our StreamableHTTPServerTransport needs
      await transport.handleRequest(req as any, streamResponse as any);
      
      return response;
    });

    // Add health check endpoint
    app.get('/', (c) => {
      return c.json({
        name: SERVER_NAME,
        version: SERVER_VERSION,
        status: "up",
        availableModels
      });
    });

    // Start the server on any available port if PORT is 0
    serve({
      fetch: app.fetch,
      port: PORT,
      hostname: HOST
    }, (info) => {
      // Store the actual port that was assigned
      const actualPort = info.port;
      
      // Log all available endpoints
      logger.info(`Server is running on http://${HOST}:${actualPort}`);
      logger.info(`Health check: http://${HOST}:${actualPort}/`);
      logger.info(`MCP endpoint: http://${HOST}:${actualPort}/mcp`);
      
      // Write port info to stderr instead of stdout to avoid MCP protocol issues
      console.error(`CLAUDE_CODE_REVIEW_PORT=${actualPort}`);
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