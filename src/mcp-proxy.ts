/**
 * MCP Proxy for Claude Desktop
 * 
 * This creates a pure TCP proxy that handles the socket-level communication
 * between Claude Desktop and our MCP server, specifically focusing on
 * fixing the JSON serialization issues that Claude Desktop experiences.
 */

import { createServer as createNetServer, createConnection, Socket } from 'node:net';
import * as logger from './utils/logger.js';

/**
 * Start a simple TCP socket proxy specifically designed for Claude Desktop
 * 
 * @param targetPort The port of our actual MCP server
 * @param targetHost The host of our actual MCP server
 * @returns The port that the proxy is running on
 */
export async function startProxy(targetPort: number, targetHost: string): Promise<number> {
  return new Promise((resolve) => {
    // Create a TCP server to handle the raw socket connections
    const server = createNetServer((clientSocket) => {
      logger.info('Client connected to proxy');
      
      // Connect to our target MCP server
      const serverSocket = createConnection({
        host: targetHost,
        port: targetPort
      });
      
      // Handle data from client -> server (pass through)
      clientSocket.on('data', (data) => {
        try {
          // Simply pass through client requests without modification
          serverSocket.write(data);
        } catch (err) {
          logger.error('Error processing client request:', err);
          // If processing fails, still try to send the original data
          serverSocket.write(data);
        }
      });
      
      // Buffer to collect fragmented JSON responses
      let responseBuffer = '';
      
      // Handle data from server -> client with JSON repair
      serverSocket.on('data', (data) => {
        try {
          // Convert the buffer to a string
          const responseText = data.toString('utf-8');
          
          // Add to buffer - we need to handle potential fragmentation
          responseBuffer += responseText;
          
          // Check if the buffer contains a complete JSON-RPC message
          if (responseBuffer.includes('"jsonrpc":') || responseBuffer.includes('"content":')) {
            logger.info('Processing response with potential JSON');
            
            // Replace problematic sequences that cause Claude Desktop to fail
            let sanitizedResponse = responseBuffer;
            
            // Fix JSON array issues - Claude Desktop has trouble with certain array formats
            // Specifically target the JSON parsing error seen in logs
            sanitizedResponse = sanitizedResponse.replace(/\[\s*"([^"]+)"\s*,/g, '["$1",');
            sanitizedResponse = sanitizedResponse.replace(/\[\s*'([^']+)'\s*,/g, '["$1",');
            
            // Fix unexpected non-whitespace issues after JSON
            sanitizedResponse = sanitizedResponse.replace(/}\s*{/g, '}\n{');
            
            // Ensure all model IDs use underscores instead of dots/hyphens
            sanitizedResponse = sanitizedResponse.replace(/"(gemini-[0-9.-]+)"/g, '"gemini_$1"');
            sanitizedResponse = sanitizedResponse.replace(/"(gpt-[0-9.-]+)"/g, '"gpt_$1"');
            
            // Clear the buffer after processing
            responseBuffer = '';
            
            // Send the sanitized response to the client
            clientSocket.write(Buffer.from(sanitizedResponse, 'utf-8'));
            return;
          }
          
          // If the current chunk doesn't look like JSON, pass through as-is
          if (!responseText.includes('"jsonrpc":') && !responseText.includes('"content":')) {
            // This chunk has no JSON markers, send it directly
            clientSocket.write(data);
            responseBuffer = ''; // Clear buffer for non-JSON data
          }
          
          // Otherwise keep buffering until we get a complete message
          
        } catch (err) {
          logger.error('Error processing server response:', err);
          // If anything fails, pass through the original data
          clientSocket.write(data);
          responseBuffer = ''; // Clear buffer on error
        }
      });
      
      // Handle various socket events
      clientSocket.on('end', () => {
        logger.info('Client disconnected from proxy');
        serverSocket.end();
      });
      
      serverSocket.on('end', () => {
        logger.info('Server disconnected from proxy');
        clientSocket.end();
      });
      
      clientSocket.on('error', (err) => {
        logger.error('Client socket error:', err);
        if (!serverSocket.destroyed) {
          serverSocket.end();
        }
      });
      
      serverSocket.on('error', (err) => {
        logger.error('Server socket error:', err);
        if (!clientSocket.destroyed) {
          clientSocket.end();
        }
      });
      
      // Log connection status
      serverSocket.on('connect', () => {
        logger.info('Proxy connected to target server');
      });
    });
    
    // Start the proxy server on a random available port
    server.listen(0, () => {
      const address = server.address() as { port: number };
      const proxyPort = address.port;
      logger.info(`TCP socket proxy running on port ${proxyPort}`);
      resolve(proxyPort);
    });
    
    // Handle server errors
    server.on('error', (err) => {
      logger.error('Proxy server error:', err);
    });
  });
}