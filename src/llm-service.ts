import { CoreMessage, generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { LLMProvider, getApiKey } from "./config.js"; // Ensure .js for ESM NodeNext

// Define model types for typechecking
type GoogleModelName = string;
type AnthropicModelName = string;
type OpenAIModelName = string;

// Get the appropriate model type based on provider
type ModelName<T extends LLMProvider> = T extends "openai"
  ? OpenAIModelName
  : T extends "anthropic"
  ? AnthropicModelName
  : T extends "google"
  ? GoogleModelName
  : never;

export async function getLLMReview<T extends LLMProvider>(
  provider: T,
  modelName: ModelName<T>,
  systemPrompt: string,
  userMessages: CoreMessage[]
): Promise<string> {
  // Make sure we have the API key
  const apiKey = getApiKey(provider);
  if (!apiKey) {
    throw new Error(
      `API key for ${provider} is not configured. Please set the appropriate environment variable.`
    );
  }

  // Create the LLM client with proper provider configuration
  let llmClient;
  switch (provider) {
    case "google":
      // Create Google provider with explicit API key
      const googleAI = createGoogleGenerativeAI({
        apiKey,
      });
      llmClient = googleAI(modelName);
      break;
    case "openai":
      // Create OpenAI provider with explicit API key
      const openaiProvider = createOpenAI({
        apiKey,
      });
      llmClient = openaiProvider(modelName);
      break;
    case "anthropic":
      // Create Anthropic provider with explicit API key
      const anthropicProvider = createAnthropic({
        apiKey,
      });
      llmClient = anthropicProvider(modelName);
      break;
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }

  try {
    console.log(
      `[MCP Server LLM] Requesting review from ${provider} model ${modelName}.`
    );
    const { text, finishReason, usage, warnings } = await generateText({
      model: llmClient,
      system: systemPrompt,
      messages: userMessages,
      maxTokens: 60000, // Increased context for review
      temperature: 0.2, // Lower temperature for more deterministic and factual reviews
    });

    if (warnings) {
      warnings.forEach((warning) =>
        console.warn(`[MCP Server LLM] Warning from ${provider}:`, warning)
      );
    }
    console.log(
      `[MCP Server LLM] Review received from ${provider}. Finish Reason: ${finishReason}, Tokens Used: Input=${usage.promptTokens}, Output=${usage.completionTokens}`
    );
    return text;
  } catch (error: any) {
    console.error(
      `[MCP Server LLM] Error getting LLM review from ${provider} (${modelName}):`,
      error
    );
    let detailedMessage = error.message;
    if (error.cause) {
      detailedMessage += ` | Cause: ${JSON.stringify(error.cause)}`;
    }
    // Attempt to get more details from common API error structures
    if (error.response && error.response.data && error.response.data.error) {
      detailedMessage += ` | API Error: ${JSON.stringify(
        error.response.data.error
      )}`;
    } else if (error.error && error.error.message) {
      // Anthropic SDK style
      detailedMessage += ` | API Error: ${error.error.message}`;
    }
    throw new Error(
      `LLM API call failed for ${provider} (${modelName}): ${detailedMessage}`
    );
  }
}