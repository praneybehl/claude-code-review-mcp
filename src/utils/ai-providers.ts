import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, generateText } from "ai";
import type { LanguageModelV1 } from "ai";
import pRetry from "p-retry";
import { 
  structuredReviewOutputSchema, 
  freeformReviewOutputSchema,
  Review
} from "../schemas/index.js";
import type { 
  CodeReviewInput,
  StructuredReviewOutput,
  FreeformReviewOutput
} from "../schemas/index.js";
import { 
  getModelProvider, 
  modelMapping, 
  isModelAvailable, 
  ModelProvider,
  getAvailableModels,
  OPENAI_API_KEY,
  GOOGLE_API_KEY,
  ANTHROPIC_API_KEY
} from "../config/index.js";
import * as logger from "./logger.js";

/**
 * Enhanced AI Provider module
 * Handles AI provider integration with proper error handling and retry logic
 */

// Maximum number of retries for API failures
const MAX_RETRIES = 3;

// Default AI request timeout (15 seconds)
const REQUEST_TIMEOUT = 15000;

/**
 * Create a structured review prompt based on input
 */
function createStructuredReviewPrompt(input: CodeReviewInput): string {
  let prompt = `Review the following code${input.filename ? ` (${input.filename})` : ""}${input.language ? ` written in ${input.language}` : ""}:

\`\`\`
${input.code}
\`\`\`

`;

  // Add project context if available
  if (input.projectContext) {
    if (input.projectContext.commitMessage) {
      prompt += `\nCommit message: "${input.projectContext.commitMessage}"\n`;
    }

    if (input.projectContext.projectStructure) {
      prompt += `\nProject structure:\n${input.projectContext.projectStructure}\n`;
    }

    if (input.projectContext.dependencies && Object.keys(input.projectContext.dependencies).length > 0) {
      prompt += "\nProject dependencies:\n";
      for (const [dep, version] of Object.entries(input.projectContext.dependencies)) {
        prompt += `- ${dep}: ${version}\n`;
      }
    }

    if (input.projectContext.relatedFiles?.length) {
      prompt += "\nRelated files:\n";
      for (const file of input.projectContext.relatedFiles) {
        prompt += `\nFile: ${file.name}${file.language ? ` (${file.language})` : ""}\n`;
        prompt += "```\n";
        prompt += file.content;
        prompt += "\n```\n";
      }
    }
  }

  prompt += `\nProvide a detailed code review covering:
1. Overall summary of the code quality
2. Strengths and weaknesses
3. Any bugs or issues, with severity (Low/Medium/High) and suggestions to fix
4. Potential improvements
5. Security issues if any

Your review should be structured, actionable, and professional.`;

  return prompt;
}

/**
 * Create a freeform review prompt based on input
 */
function createFreeformReviewPrompt(input: CodeReviewInput): string {
  let prompt = `Review the following code${input.filename ? ` (${input.filename})` : ""}${input.language ? ` written in ${input.language}` : ""}:

\`\`\`
${input.code}
\`\`\`

`;

  // Add project context if available
  if (input.projectContext) {
    if (input.projectContext.commitMessage) {
      prompt += `\nCommit message: "${input.projectContext.commitMessage}"\n`;
    }

    if (input.projectContext.projectStructure) {
      prompt += `\nProject structure:\n${input.projectContext.projectStructure}\n`;
    }

    if (input.projectContext.dependencies && Object.keys(input.projectContext.dependencies).length > 0) {
      prompt += "\nProject dependencies:\n";
      for (const [dep, version] of Object.entries(input.projectContext.dependencies)) {
        prompt += `- ${dep}: ${version}\n`;
      }
    }

    if (input.projectContext.relatedFiles?.length) {
      prompt += "\nRelated files:\n";
      for (const file of input.projectContext.relatedFiles) {
        prompt += `\nFile: ${file.name}${file.language ? ` (${file.language})` : ""}\n`;
        prompt += "```\n";
        prompt += file.content;
        prompt += "\n```\n";
      }
    }
  }

  prompt += `\nProvide a thorough code review that discusses:
- The overall quality and readability of the code
- Any bugs, issues, or potential problems
- Suggestions for improvements
- Best practices that could be applied
- Security considerations if applicable

Write your review in a clear, professional manner, focusing on being helpful and constructive rather than critical.`;

  return prompt;
}

/**
 * Get the appropriate AI model instance based on provider
 */
function getModel(modelId: string): LanguageModelV1 {
  if (!isModelAvailable(modelId)) {
    throw new Error(`Model ${modelId} is not available.`);
  }

  const provider = getModelProvider(modelId);
  
  // Set up environment variables for providers - the SDKs read from process.env
  // We'll set them temporarily for the duration of this call
  const originalEnv = { ...process.env };
  
  try {
    switch (provider) {
      case "openai":
        process.env.OPENAI_API_KEY = OPENAI_API_KEY;
        return openai(modelId as any);
        
      case "google":
        process.env.GOOGLE_API_KEY = GOOGLE_API_KEY;
        return google(modelId as any);
        
      case "anthropic":
        process.env.ANTHROPIC_API_KEY = ANTHROPIC_API_KEY;
        return anthropic(modelId as any);
        
      default:
        throw new Error(`Provider for model ${modelId} not supported.`);
    }
  } finally {
    // Restore original environment to prevent leaking keys
    process.env = originalEnv;
  }
}

/**
 * Generate a structured code review with retry logic
 */
export async function generateStructuredReview(input: CodeReviewInput): Promise<StructuredReviewOutput> {
  try {
    // Check if model is available before proceeding
    if (!isModelAvailable(input.model)) {
      logger.warn(`Requested model ${input.model} is not available`);
      return {
        modelUsed: "None",
        error: `Model ${input.model} is not available or the required API key is not provided.`,
        availableModels: getAvailableModels(),
      };
    }

    logger.info(`Generating structured review with model: ${input.model}`);
    const model = getModel(input.model);
    const prompt = createStructuredReviewPrompt(input);

    // Use retry logic for API requests
    const result = await pRetry(
      async () => {
        return await generateObject({
          model,
          schema: structuredReviewOutputSchema.omit({ modelUsed: true, error: true, availableModels: true }).shape.review,
          prompt,
        });
      },
      {
        retries: MAX_RETRIES,
        onFailedAttempt: (error) => {
          logger.warn(`Structured review attempt failed (${error.attemptNumber}/${MAX_RETRIES + 1}): ${error.message}`);
        }
      }
    );

    logger.info(`Successfully generated structured review with model: ${input.model}`);
    return {
      review: result.object as Review,
      modelUsed: modelMapping[input.model as keyof typeof modelMapping] || input.model,
    };
  } catch (error) {
    logger.error(`Error generating structured review: ${(error as Error).message}`, error);
    return {
      modelUsed: "None",
      error: `Error generating review: ${(error as Error).message}`,
      availableModels: getAvailableModels(),
    };
  }
}

/**
 * Generate a freeform code review with retry logic
 */
export async function generateFreeformReview(input: CodeReviewInput): Promise<FreeformReviewOutput> {
  try {
    // Check if model is available before proceeding
    if (!isModelAvailable(input.model)) {
      logger.warn(`Requested model ${input.model} is not available`);
      return {
        modelUsed: "None",
        error: `Model ${input.model} is not available or the required API key is not provided.`,
        availableModels: getAvailableModels(),
      };
    }

    logger.info(`Generating freeform review with model: ${input.model}`);
    const model = getModel(input.model);
    const prompt = createFreeformReviewPrompt(input);

    // Use retry logic for API requests
    const result = await pRetry(
      async () => {
        return await generateText({
          model,
          prompt,
        });
      },
      {
        retries: MAX_RETRIES,
        onFailedAttempt: (error) => {
          logger.warn(`Freeform review attempt failed (${error.attemptNumber}/${MAX_RETRIES + 1}): ${error.message}`);
        }
      }
    );

    logger.info(`Successfully generated freeform review with model: ${input.model}`);
    return {
      reviewText: result.text,
      modelUsed: modelMapping[input.model as keyof typeof modelMapping] || input.model,
    };
  } catch (error) {
    logger.error(`Error generating freeform review: ${(error as Error).message}`, error);
    return {
      modelUsed: "None",
      error: `Error generating review: ${(error as Error).message}`,
      availableModels: getAvailableModels(),
    };
  }
}

/**
 * Helper function to get summary information about available providers
 */
export function getProviderSummary(): Record<string, any> {
  return {
    openai: {
      available: !!OPENAI_API_KEY,
      models: modelCategories.openai.filter(model => isModelAvailable(model)),
    },
    google: {
      available: !!GOOGLE_API_KEY,
      models: modelCategories.google.filter(model => isModelAvailable(model)),
    },
    anthropic: {
      available: !!ANTHROPIC_API_KEY,
      models: modelCategories.anthropic.filter(model => isModelAvailable(model)),
    },
  };
}

// Import modelCategories for provider summary
import { modelCategories } from "../config/index.js";