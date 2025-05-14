/**
 * Helper functions for MCP transport protocol
 */

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
      const writer = writeStream.getWriter();
      writer.write(new TextEncoder().encode(chunk));
      writer.releaseLock();
      return true;
    },
    end: (chunk?: any) => {
      const writer = writeStream.getWriter();
      if (chunk) {
        writer.write(new TextEncoder().encode(chunk));
      }
      writer.close();
      return true;
    },
    finished: true,
    statusCode: 200
  };
}