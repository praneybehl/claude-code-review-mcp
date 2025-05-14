import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { 
  codeReviewInputSchema,
  listModelsInputSchema
} from "../schemas/index.js";
import type { 
  CodeReviewInput,
  ListModelsInput
} from "../schemas/index.js";
import { 
  generateStructuredReview, 
  generateFreeformReview,
  getProviderSummary
} from "../utils/ai-providers.js";
import { 
  getAvailableModels, 
  getDefaultModel, 
  isModelAvailable,
  modelMapping,
  SERVER_NAME, 
  SERVER_VERSION 
} from "../config/index.js";
import * as logger from "../utils/logger.js";
import { sanitizeJson } from "../utils/json-safe.js";

/**
 * Helper function to sanitize model IDs in results for Claude Desktop compatibility
 * 
 * Model IDs often contain dots and hyphens which can cause issues with JSON parsing
 * in some clients, especially Claude Desktop. This function converts those characters
 * to underscores for safer JSON handling.
 * 
 * @param data Object containing model ID keys that may have dots or hyphens
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
 * Fully sanitize data for maximum compatibility with all MCP clients
 * This combines model ID sanitization with JSON format sanitization
 */
function fullySanitize(data: Record<string, any>): Record<string, any> {
  try {
    // First sanitize model IDs
    const modelSanitized = sanitizeModelIds(data);
    
    // Then apply JSON sanitization (stringify and re-parse through our sanitizer)
    const jsonSanitized = JSON.parse(sanitizeJson(JSON.stringify(modelSanitized)));
    
    return jsonSanitized;
  } catch (error) {
    logger.error("Error during full sanitization:", error);
    // Return the original data if sanitization fails
    return data;
  }
}

/**
 * Validate input model parameter and suggest alternatives if needed
 * 
 * @param input Input parameters containing model selection
 * @returns Object with validation result and suggested model if needed
 */
function validateModelInput(input: CodeReviewInput): { 
  valid: boolean; 
  suggestedModel?: string; 
  error?: string; 
} {
  // If model not specified, use default
  if (!input.model) {
    const defaultModel = getDefaultModel();
    logger.info(`No model specified, using default: ${defaultModel}`);
    return { 
      valid: true,
      suggestedModel: defaultModel
    };
  }

  // Check if model is available
  if (!isModelAvailable(input.model)) {
    logger.warn(`Requested model ${input.model} is not available`);
    
    // Try to suggest an alternative model
    try {
      const suggestedModel = getDefaultModel();
      return {
        valid: false,
        suggestedModel,
        error: `Model "${input.model}" is not available. Try using "${suggestedModel}" instead.`
      };
    } catch (error) {
      // No suitable alternative
      return {
        valid: false,
        error: `Model "${input.model}" is not available and no alternative models are available. Please provide a valid API key.`
      };
    }
  }

  return { valid: true };
}

/**
 * Log code review request details (safely, without exposing full code)
 * 
 * @param type Type of review (structured or freeform)
 * @param input Input parameters
 */
function logReviewRequest(type: string, input: CodeReviewInput): void {
  logger.info(`Received request for ${type} code review`, { 
    modelRequested: input.model,
    filename: input.filename || "(no filename provided)",
    language: input.language || "(no language specified)",
    codeLength: input.code.length,
    hasProjectContext: !!input.projectContext,
    relatedFileCount: input.projectContext?.relatedFiles?.length || 0
  });
}

/**
 * Register all MCP tools for the code review server
 */
export function registerTools(server: McpServer): void {
  // Register the three required tools specified in requirements
  registerReviewCodeStructuredTool(server);
  registerReviewCodeFreeformTool(server);
  registerListModelsTool(server);
}

/**
 * Register the structured code review tool
 */
function registerReviewCodeStructuredTool(server: McpServer): void {
  // Use the schema from our Zod definitions
  const parameters = codeReviewInputSchema.shape;

  server.tool(
    "reviewCodeStructured",
    parameters,
    async (input: CodeReviewInput) => {
      // Log request (safely)
      logReviewRequest("structured", input);

      try {
        // Validate model selection
        const validation = validateModelInput(input);
        
        if (!validation.valid) {
          const availableModels = getAvailableModels();
          
          return fullySanitize({
            modelUsed: "None",
            error: validation.error,
            suggestedModel: validation.suggestedModel,
            availableModels
          });
        }

        // Use suggested model if provided
        if (validation.suggestedModel) {
          input.model = validation.suggestedModel;
        }

        // Generate the structured review
        const result = await generateStructuredReview(input);
        
        logger.info("Successfully generated structured review", {
          modelUsed: result.modelUsed,
          hasReview: !!result.review
        });

        // Return the fully sanitized result for maximum compatibility
        return fullySanitize(result);
      } catch (error) {
        logger.error("Error in reviewCodeStructured tool", error);
        const availableModels = getAvailableModels();
        
        return fullySanitize({
          modelUsed: "None",
          error: `Error generating review: ${(error as Error).message}`,
          availableModels
        });
      }
    }
  );
}

/**
 * Register the freeform code review tool
 */
function registerReviewCodeFreeformTool(server: McpServer): void {
  // Use the schema from our Zod definitions
  const parameters = codeReviewInputSchema.shape;

  server.tool(
    "reviewCodeFreeform",
    parameters,
    async (input: CodeReviewInput) => {
      // Log request (safely)
      logReviewRequest("freeform", input);

      try {
        // Validate model selection
        const validation = validateModelInput(input);
        
        if (!validation.valid) {
          const availableModels = getAvailableModels();
          
          return fullySanitize({
            modelUsed: "None",
            error: validation.error,
            suggestedModel: validation.suggestedModel,
            availableModels
          });
        }

        // Use suggested model if provided
        if (validation.suggestedModel) {
          input.model = validation.suggestedModel;
        }

        // Generate the freeform review
        const result = await generateFreeformReview(input);
        
        logger.info("Successfully generated freeform review", {
          modelUsed: result.modelUsed,
          hasReviewText: !!result.reviewText,
          reviewTextLength: result.reviewText?.length || 0
        });

        // Return the fully sanitized result for maximum compatibility
        return fullySanitize(result);
      } catch (error) {
        logger.error("Error in reviewCodeFreeform tool", error);
        const availableModels = getAvailableModels();
        
        return fullySanitize({
          modelUsed: "None",
          error: `Error generating review: ${(error as Error).message}`,
          availableModels
        });
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
    listModelsInputSchema.shape, // Empty Zod object
    async (_input: ListModelsInput) => {
      logger.info("Received request to list available models");

      try {
        const availableModels = getAvailableModels();
        const providerSummary = getProviderSummary();
        
        logger.info("Listing available models", {
          modelCount: Object.keys(availableModels).length,
          providers: Object.keys(providerSummary)
            .filter(provider => providerSummary[provider].available)
            .join(", ")
        });

        // Return the fully sanitized result for maximum compatibility
        return fullySanitize({
          availableModels,
          modelUsed: "None",
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION,
            providers: providerSummary
          }
        });
      } catch (error) {
        logger.error("Error in listModels tool", error);
        
        return fullySanitize({
          availableModels: {},
          modelUsed: "None",
          error: `Error listing models: ${(error as Error).message}`
        });
      }
    }
  );
}