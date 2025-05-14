import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  codeReviewInputSchema
} from "../schemas/index.js";
import type { CodeReviewInput } from "../schemas/index.js";
import { 
  generateStructuredReview, 
  generateFreeformReview 
} from "../utils/ai-providers.js";
import { getAvailableModels, getDefaultModel, isModelAvailable } from "../config/index.js";
import * as logger from "../utils/logger.js";

/**
 * Helper function to sanitize model IDs in results
 * @param models Object containing model ID keys that may have dots or hyphens
 * @returns A copy with no special characters in keys
 */
function sanitizeModelIds(data: Record<string, any>): Record<string, any> {
  // Process available models to convert any non-standard keys
  if (data && typeof data === 'object' && 'availableModels' in data) {
    const models = data.availableModels || {};
    const sanitizedModels: Record<string, string> = {};
    
    // Sanitize model keys - replace dots and hyphens with underscores
    for (const [modelId, modelName] of Object.entries(models)) {
      // Convert model IDs like "gemini-1.5-pro" to "gemini_1_5_pro"
      const safeKey = modelId.replace(/[.-]/g, '_');
      sanitizedModels[safeKey] = String(modelName);
    }
    
    // Return a new object with sanitized model IDs
    return {
      ...data,
      availableModels: sanitizedModels
    };
  }
  
  return data;
}

/**
 * Register all MCP tools for the code review server
 */
export function registerTools(server: McpServer): void {
  registerReviewCodeStructuredTool(server);
  registerReviewCodeFreeformTool(server);
  registerListModelsTool(server);
}

/**
 * Register the structured code review tool
 */
function registerReviewCodeStructuredTool(server: McpServer): void {
  // Use the schema from our definitions
  const parameters = codeReviewInputSchema.shape;

  server.tool(
    "reviewCodeStructured",
    parameters,
    async (input: CodeReviewInput) => {
      logger.info("Received request for structured code review", { 
        modelRequested: input.model,
        filename: input.filename,
        language: input.language,
        codeLength: input.code.length
      });

      try {
        // If model not specified, use default
        if (!input.model) {
          input.model = getDefaultModel();
          logger.info(`No model specified, using default: ${input.model}`);
        }

        // Check if model is available
        if (!isModelAvailable(input.model)) {
          logger.warn(`Requested model ${input.model} is not available`);
          const availableModels = getAvailableModels();
          
          return {
            modelUsed: "None",
            error: `Model ${input.model} is not available or the required API key is not provided.`,
            availableModels: sanitizeModelIds({availableModels}).availableModels
          };
        }

        // Generate the review
        const result = await generateStructuredReview(input);
        
        logger.info("Successfully generated structured review", {
          modelUsed: result.modelUsed
        });

        // Return the review result directly - MCP SDK will handle serialization
        return sanitizeModelIds(result);
      } catch (error) {
        logger.error("Error in reviewCodeStructured tool", error);
        const availableModels = getAvailableModels();
        return {
          modelUsed: "None",
          error: `Error generating review: ${(error as Error).message}`,
          availableModels: sanitizeModelIds({availableModels}).availableModels
        };
      }
    }
  );
}

/**
 * Register the freeform code review tool
 */
function registerReviewCodeFreeformTool(server: McpServer): void {
  // Use the schema from our definitions
  const parameters = codeReviewInputSchema.shape;

  server.tool(
    "reviewCodeFreeform",
    parameters,
    async (input: CodeReviewInput) => {
      logger.info("Received request for freeform code review", { 
        modelRequested: input.model,
        filename: input.filename,
        language: input.language,
        codeLength: input.code.length
      });

      try {
        // If model not specified, use default
        if (!input.model) {
          input.model = getDefaultModel();
          logger.info(`No model specified, using default: ${input.model}`);
        }

        // Check if model is available
        if (!isModelAvailable(input.model)) {
          logger.warn(`Requested model ${input.model} is not available`);
          const availableModels = getAvailableModels();
          
          return {
            modelUsed: "None",
            error: `Model ${input.model} is not available or the required API key is not provided.`,
            availableModels: sanitizeModelIds({availableModels}).availableModels
          };
        }

        // Generate the review
        const result = await generateFreeformReview(input);
        
        logger.info("Successfully generated freeform review", {
          modelUsed: result.modelUsed
        });

        // Return the review result directly - MCP SDK will handle serialization
        return sanitizeModelIds(result);
      } catch (error) {
        logger.error("Error in reviewCodeFreeform tool", error);
        const availableModels = getAvailableModels();
        return {
          modelUsed: "None",
          error: `Error generating review: ${(error as Error).message}`,
          availableModels: sanitizeModelIds({availableModels}).availableModels
        };
      }
    }
  );
}

/**
 * Register the list models tool
 */
function registerListModelsTool(server: McpServer): void {
  server.tool(
    "listModels",
    {}, // Empty parameters object
    async () => {
      logger.info("Received request to list available models");

      try {
        const availableModels = getAvailableModels();
        
        // Return the models directly - MCP SDK will handle serialization
        return {
          availableModels: sanitizeModelIds({availableModels}).availableModels,
          modelUsed: "None"
        };
      } catch (error) {
        logger.error("Error in listModels tool", error);
        return {
          availableModels: {},
          modelUsed: "None",
          error: `Error listing models: ${(error as Error).message}`
        };
      }
    }
  );
}