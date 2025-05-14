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
  // Handle null or undefined
  if (data === null || data === undefined) {
    return data;
  }
  
  // Handle strings directly
  if (typeof data === 'string') {
    return data;
  }
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => formatForMcpResponse(item));
  }
  
  // Handle objects (including availableModels)
  if (typeof data === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      // Create a safe key that's guaranteed to be JSON compatible
      // Use a standardized transform so periods and special chars are consistently handled
      const safeKey = key
        .replace(/\./g, "dot")
        .replace(/\-/g, "dash")
        .replace(/[^a-zA-Z0-9_]/g, "_");
      
      result[safeKey] = formatForMcpResponse(value);
    }
    return result;
  }
  
  // For other primitives, return as-is
  return data;
}

/**
 * Safely convert object to JSON string, handling any JSON-unfriendly values
 * like single quotes, etc.
 */
function safeJsonStringify(obj: any): string {
  if (typeof obj === 'string') {
    return obj;
  }
  
  try {
    // Use our formatter to ensure MCP-compatible JSON
    const safeObj = formatForMcpResponse(obj);
    return JSON.stringify(safeObj);
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
 * Creates a simple response object that we can use with the MCP transport
 * 
 * @param writeStream The WritableStream to adapt
 * @returns An object with a compatible interface for MCP transport
 */
export function createStreamResponse(writeStream: WritableStream) {
  // Create a response-like object that can be used with the MCP SDK
  return {
    write: (chunk: any) => {
      try {
        const writer = writeStream.getWriter();
        const data = safeJsonStringify(chunk);
        writer.write(new TextEncoder().encode(data));
        writer.releaseLock();
        return true;
      } catch (err) {
        console.error("Error writing to stream:", err);
        return false;
      }
    },
    end: (chunk?: any) => {
      try {
        const writer = writeStream.getWriter();
        if (chunk) {
          const data = safeJsonStringify(chunk);
          writer.write(new TextEncoder().encode(data));
        }
        writer.close();
        return true;
      } catch (err) {
        console.error("Error ending stream:", err);
        return false;
      }
    },
    finished: true,
    statusCode: 200
  };
}