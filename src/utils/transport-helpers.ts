/**
 * Helper functions for MCP transport protocol
 */

/**
 * Format model IDs and other objects for safe JSON serialization
 * This preserves the actual model IDs while making them safe for JSON transmission
 * 
 * @param models Object containing model IDs as keys
 * @returns An object with safe keys for serialization
 */
export function formatForMcpResponse(data: any): any {
  // Simplified formatting - this is safer for MCP responses
  try {
    if (data === null || data === undefined) {
      return null;
    }

    // When dealing with model objects, use a more specific approach
    if (typeof data === 'object' && !Array.isArray(data)) {
      const result: { [key: string]: any } = {};
      
      // Handle availableModels specifically
      if (Object.keys(data).some(key => key.includes('-') || key.includes('.'))) {
        // This is likely a model mapping - convert to safe format
        for (const [key, value] of Object.entries(data)) {
          // Create alphanumeric keys only
          const safeKey = key.replace(/[^a-zA-Z0-9]/g, '_');
          result[safeKey] = String(value);
        }
      } else {
        // For other objects, process recursively
        for (const [key, value] of Object.entries(data)) {
          // Use only alphanumeric keys
          const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
          result[safeKey] = formatForMcpResponse(value);
        }
      }
      return result;
    }
    
    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => formatForMcpResponse(item));
    }
    
    // Basic types are returned as-is
    if (typeof data === 'number' || typeof data === 'boolean') {
      return data;
    }
    
    // Always convert strings to ensure they're valid
    return String(data);
  } catch (err) {
    console.error("Error formatting MCP response:", err);
    return null;
  }
}

/**
 * Safely convert object to JSON string, handling any JSON-unfriendly values.
 * This follows the MCP protocol requirements for JSON-RPC 2.0.
 */
function safeJsonStringify(obj: any): string {
  // If it's already a string, return it directly
  if (typeof obj === 'string') {
    return obj;
  }
  
  try {
    // For model responses, we need to handle them specially
    if (obj && typeof obj === 'object' && 'availableModels' in obj) {
      // Special handling for model lists
      const cleanModels = {} as Record<string, string>;
      
      // Clone the model mapping with safe keys
      const modelMap = obj.availableModels || {};
      for (const [key, value] of Object.entries(modelMap)) {
        const safeKey = key.replace(/[.-]/g, '_'); // Only replace dots and hyphens
        cleanModels[safeKey] = String(value);
      }
      
      // Create a clean copy of the object
      const cleanObj = {
        ...obj,
        availableModels: cleanModels
      };
      
      return JSON.stringify(cleanObj);
    }
    
    // For responses with review data, just do basic serialization
    if (obj && typeof obj === 'object' && ('review' in obj || 'reviewText' in obj)) {
      return JSON.stringify(obj);
    }
    
    // For everything else, use standard JSON
    return JSON.stringify(obj);
  } catch (err) {
    console.error("Error stringifying object:", err);
    // Return a safe fallback
    return JSON.stringify({ 
      jsonrpc: "2.0", 
      error: { 
        code: -32603, 
        message: "Internal JSON-RPC error: Could not serialize response" 
      }, 
      id: null 
    });
  }
}

/**
 * Creates a Stream Response that complies with the MCP transport protocol.
 * 
 * This function creates an object with the correct interface expected by
 * the StreamableHTTPServerTransport.handleRequest method.
 * 
 * @param writeStream The WritableStream to adapt
 * @returns An object with a compatible interface for MCP transport
 */
export function createStreamResponse(writeStream: WritableStream) {
  // Create a response-like object that can be used with the MCP SDK
  return {
    // The write method is called for each chunk of data
    write: (chunk: any) => {
      try {
        // Get a writer for the stream
        const writer = writeStream.getWriter();
        
        // Process the data to ensure safe JSON
        let data: string;
        
        // If it's a string, assume it's already properly formatted
        if (typeof chunk === 'string') {
          data = chunk;
        } else {
          // Otherwise, use our specialized stringifier
          data = safeJsonStringify(chunk);
        }
        
        // Encode and write the data
        writer.write(new TextEncoder().encode(data));
        writer.releaseLock();
        
        return true;
      } catch (err) {
        // Log any errors but don't throw - the transport needs to keep running
        console.error("Stream write error:", err);
        return false;
      }
    },
    
    // The end method is called when the response is complete
    end: (chunk?: any) => {
      try {
        const writer = writeStream.getWriter();
        
        // Handle any final chunk of data
        if (chunk) {
          let finalData: string;
          
          if (typeof chunk === 'string') {
            finalData = chunk;
          } else {
            finalData = safeJsonStringify(chunk);
          }
          
          writer.write(new TextEncoder().encode(finalData));
        }
        
        // Close the stream to signal the end of the response
        writer.close();
        return true;
      } catch (err) {
        console.error("Stream end error:", err);
        return false;
      }
    },
    
    // These properties are required by the MCP transport interface
    finished: true,
    statusCode: 200
  };
}