/**
 * MCP Proxy - A simple proxy layer between our MCP server and Claude Desktop
 * 
 * This module provides a clean interface for Claude Desktop to connect to our MCP server
 * while ensuring that all JSON is properly formatted according to the MCP protocol.
 */

import { createServer } from 'node:http';
import { createConnection } from 'node:net';
import * as logger from './utils/logger.js';

/**
 * Start the proxy server that sits between Claude Desktop and our MCP server
 * 
 * @param targetPort The port of our actual MCP server
 * @param targetHost The host of our actual MCP server
 * @returns The port that the proxy is running on
 */
export async function startProxy(targetPort: number, targetHost: string): Promise<number> {
  return new Promise((resolve) => {
    // Create a proxy server
    const proxy = createServer((clientReq, clientRes) => {
      // Log incoming request
      logger.info(`Proxy received ${clientReq.method} request for ${clientReq.url}`);
      
      // Connect to the target server
      const targetConnection = createConnection({ port: targetPort, host: targetHost }, () => {
        logger.info('Proxy connected to MCP server');
        
        // Write the request headers to the target connection
        targetConnection.write(`${clientReq.method} ${clientReq.url} HTTP/1.1\r\n`);
        
        // Copy all headers except host
        Object.keys(clientReq.headers).forEach((key) => {
          if (key === 'host') return;
          const value = clientReq.headers[key];
          if (value) {
            targetConnection.write(`${key}: ${value}\r\n`);
          }
        });
        
        // Add the correct host header
        targetConnection.write(`Host: ${targetHost}:${targetPort}\r\n`);
        
        // End headers
        targetConnection.write('\r\n');
        
        // Pipe the request body to the target connection
        clientReq.pipe(targetConnection);
      });
      
      // Handle response from target
      targetConnection.on('data', (chunk) => {
        // Clean up any potential malformed JSON in the response
        try {
          // Only attempt to clean up JSON if it's a JSON response
          const contentType = String(chunk).match(/Content-Type:\s*application\/json/i);
          
          if (contentType) {
            logger.info('Proxy detected JSON response, cleaning up');
            
            // Find the body in the HTTP response
            const bodyMatch = String(chunk).match(/(\r\n\r\n)(.*)/s);
            
            if (bodyMatch && bodyMatch[2]) {
              const [fullMatch, headerSeparator, body] = bodyMatch;
              
              // Extract headers to keep them intact
              const headers = String(chunk).substring(0, chunk.length - body.length - headerSeparator.length);
              
              // Try to parse and re-stringify the JSON to ensure it's valid
              try {
                // Parse the JSON body
                const parsedBody = JSON.parse(body);
                
                // Re-stringify to ensure it's valid JSON
                const cleanedBody = JSON.stringify(parsedBody);
                
                // Create a new response
                const cleanedResponse = headers + headerSeparator + cleanedBody;
                
                // Write the cleaned response
                clientRes.write(cleanedResponse);
                return;
              } catch (e) {
                logger.error('Failed to clean JSON response, passing through as-is', e);
              }
            }
          }
          
          // If we get here, it's not JSON or we couldn't clean it up - pass through as-is
          clientRes.write(chunk);
        } catch (error) {
          // If anything goes wrong, just pass through the original chunk
          logger.error('Error in proxy data handler:', error);
          clientRes.write(chunk);
        }
      });
      
      // Handle target connection end
      targetConnection.on('end', () => {
        clientRes.end();
        logger.info('Proxy target connection ended');
      });
      
      // Handle target connection errors
      targetConnection.on('error', (err) => {
        logger.error('Proxy target connection error:', err);
        clientRes.statusCode = 502;
        clientRes.end('Proxy Error: ' + err.message);
      });
      
      // Handle client request errors
      clientReq.on('error', (err) => {
        logger.error('Proxy client request error:', err);
        targetConnection.end();
      });
      
      // Handle client response errors
      clientRes.on('error', (err) => {
        logger.error('Proxy client response error:', err);
        targetConnection.end();
      });
    });
    
    // Start the proxy server on a random available port
    proxy.listen(0, () => {
      const address = proxy.address() as { port: number };
      const proxyPort = address.port;
      logger.info(`Proxy server running on port ${proxyPort}`);
      resolve(proxyPort);
    });
    
    // Handle proxy server errors
    proxy.on('error', (err) => {
      logger.error('Proxy server error:', err);
    });
  });
}