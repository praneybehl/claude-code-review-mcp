/**
 * Helper functions for MCP transport protocol
 */

/**
 * Safely convert object to JSON string, handling any JSON-unfriendly values
 * like single quotes, etc.
 */
function safeJsonStringify(obj: any): string {
  if (typeof obj === 'string') {
    return obj;
  }
  
  try {
    // Handle model keys that might have special characters
    if (obj && typeof obj === 'object') {
      // Create a clean copy to avoid modifying the original
      const cleanObj = JSON.parse(JSON.stringify(obj));
      return JSON.stringify(cleanObj);
    }
    
    return JSON.stringify(obj);
  } catch (err) {
    console.error("Error stringifying object:", err);
    // Return a safe fallback
    return JSON.stringify({ error: "Could not serialize response" });
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