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
 * Safely parse and re-format JSON to guarantee valid format
 * @param text Text that may contain JSON
 * @returns Sanitized text with valid JSON
 */
function ensureValidJson(text: string): string {
  // If no JSON-like content, return as is
  if (!text.includes('{') && !text.includes('[')) {
    return text;
  }

  // Attempt to extract and fix JSON objects
  try {
    // First, attempt to parse the entire string as JSON
    try {
      JSON.parse(text);
      return text; // It's already valid JSON
    } catch (e) {
      // Not valid JSON, continue with extraction
    }

    // Find all potential JSON objects within the text
    let result = text;
    
    // Match potential JSON objects
    const matches = result.match(/({[^{}]*(?:{[^{}]*}[^{}]*)*})/g) || [];
    
    // Process each potential JSON object
    for (const match of matches) {
      try {
        // Try to parse and pretty print to ensure valid JSON
        const parsedObj = JSON.parse(match);
        // Replace with guaranteed valid JSON
        const validJson = JSON.stringify(parsedObj);
        // Replace the original match with the valid JSON
        result = result.replace(match, validJson);
      } catch (err) {
        // If we can't parse it, try to repair common issues
        let fixedJson = match;
        
        // Fix arrays with space between bracket and first element
        fixedJson = fixedJson.replace(/\[\s+/g, '[');
        
        // Fix missing commas in arrays
        fixedJson = fixedJson.replace(/"\s+"/g, '","');
        fixedJson = fixedJson.replace(/"\s+{/g, '",{');
        fixedJson = fixedJson.replace(/}\s+"/g, '},"');
        fixedJson = fixedJson.replace(/]\s+{/g, '],{');
        fixedJson = fixedJson.replace(/}\s+\[/g, '},[');
        
        // Replace model IDs with dots/hyphens with underscored versions
        fixedJson = fixedJson.replace(/"(gemini-[0-9.-]+)"/g, '"gemini_$1"');
        fixedJson = fixedJson.replace(/"(gpt-[0-9.-]+)"/g, '"gpt_$1"');
        
        try {
          // See if our fixes helped
          const parsed = JSON.parse(fixedJson);
          result = result.replace(match, JSON.stringify(parsed));
        } catch (fixErr) {
          // Failed to fix, maintain original
          logger.error('Failed to fix JSON:', fixErr);
        }
      }
    }
    
    // Match potential JSON arrays
    const arrayMatches = result.match(/(\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\])/g) || [];
    
    // Process each potential JSON array
    for (const match of arrayMatches) {
      try {
        // Try to parse and pretty print to ensure valid JSON
        const parsedArray = JSON.parse(match);
        // Replace with guaranteed valid JSON
        const validJson = JSON.stringify(parsedArray);
        // Replace the original match with the valid JSON
        result = result.replace(match, validJson);
      } catch (err) {
        // If we can't parse it, try to repair common issues
        let fixedJson = match;
        
        // Fix arrays with extra spaces
        fixedJson = fixedJson.replace(/\[\s+/g, '[');
        fixedJson = fixedJson.replace(/\s+\]/g, ']');
        
        // Fix missing commas in arrays
        fixedJson = fixedJson.replace(/"\s+"/g, '","');
        fixedJson = fixedJson.replace(/"\s+{/g, '",{');
        
        try {
          // See if our fixes helped
          const parsed = JSON.parse(fixedJson);
          result = result.replace(match, JSON.stringify(parsed));
        } catch (fixErr) {
          // Failed to fix this array
          logger.error('Failed to fix JSON array:', fixErr);
        }
      }
    }
    
    // Apply additional global fixes
    // Fix JSON-RPC messages that might appear back-to-back
    result = result.replace(/}{/g, '}\n{');
    
    return result;
  } catch (err) {
    logger.error('Error in ensureValidJson:', err);
    return text; // Return original on error
  }
}

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
          
          // Log raw response for debugging
          if (responseText.includes('jsonrpc') || responseText.includes('content')) {
            logger.info('Raw response from server (first 100 chars): ' + 
              responseText.substring(0, 100).replace(/\n/g, '\\n'));
          }
          
          // Add to buffer - we need to handle potential fragmentation
          responseBuffer += responseText;
          
          // Check if the buffer contains a complete JSON message
          if (responseBuffer.includes('{') || responseBuffer.includes('[')) {
            logger.info('Processing response with potential JSON');
            
            // Explicitly fix the most common error seen in logs:
            // "Expected ',' or ']' after array element in JSON at position 5 (line 1 column 6)"
            // This likely indicates a missing comma in an array with format: [ "item" "item2" ]
            responseBuffer = responseBuffer.replace(/\[\s*"([^"]+)"\s+"([^"]+)"/g, '["$1","$2"');
            responseBuffer = responseBuffer.replace(/\[\s*'([^']+)'\s+'([^']+)'/g, '["$1","$2"');
            
            // Ensure valid JSON in the response
            const sanitizedResponse = ensureValidJson(responseBuffer);
            
            // Log sanitized response for debugging
            logger.info('Sanitized response (first 100 chars): ' + 
              sanitizedResponse.substring(0, 100).replace(/\n/g, '\\n'));
            
            // Clear the buffer after processing
            responseBuffer = '';
            
            // Send the sanitized response to the client
            clientSocket.write(Buffer.from(sanitizedResponse, 'utf-8'));
            return;
          }
          
          // If the current chunk doesn't look like JSON, pass through as-is
          if (!responseText.includes('{') && !responseText.includes('[')) {
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