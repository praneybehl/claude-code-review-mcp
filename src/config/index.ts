import { config } from "dotenv";
config();

/**
 * Configuration module for the MCP server
 * Handles environment variables, model mapping, and server settings
 */

// Environment variable access with validation
export function getEnv(key: string, defaultValue?: string): string | undefined {
  const value = process.env[key];
  return value !== undefined ? value : defaultValue;
}

// API Keys
export const OPENAI_API_KEY = getEnv('OPENAI_API_KEY');
export const GOOGLE_API_KEY = getEnv('GOOGLE_API_KEY'); 
export const ANTHROPIC_API_KEY = getEnv('ANTHROPIC_API_KEY');

// Server configuration
export const PORT = getEnv('PORT') ? parseInt(getEnv('PORT') || '0', 10) : 0; // Use 0 to auto-assign an available port
export const HOST = getEnv('HOST') || "127.0.0.1";

// Log level (0=DEBUG, 1=INFO, 2=WARN, 3=ERROR)
export const LOG_LEVEL = getEnv('LOG_LEVEL') ? parseInt(getEnv('LOG_LEVEL') || '1', 10) : 1;

// Server version and name
export const SERVER_VERSION = "0.10.0";
export const SERVER_NAME = "claude-code-review-mcp";

// Model Mapping - maps model IDs to human-readable names
export const modelMapping = {
  // OpenAI models
  "gpt-4.1": "OpenAI GPT-4.1",
  "o4-mini": "OpenAI O4 Mini",
  "o3-mini": "OpenAI O3 Mini",
  
  // Google models
  "gemini-2.5-pro-preview-05-06": "Google Gemini 2.5 Pro",
  "gemini-2.5-flash-preview-04-17": "Google Gemini 2.5 Flash",
  
  // Anthropic models (if supported in the future)
  "claude-3-opus-20240229": "Anthropic Claude 3 Opus",
  "claude-3-sonnet-20240229": "Anthropic Claude 3 Sonnet",
  "claude-3-haiku-20240307": "Anthropic Claude 3 Haiku",
};

// Provider determination
export type ModelProvider = "openai" | "google" | "anthropic";

// Define model categorization for easy reference
export const modelCategories = {
  openai: ["gpt-4.1", "o4-mini", "o3-mini"],
  google: ["gemini-2.5-pro-preview-05-06", "gemini-2.5-flash-preview-04-17"],
  anthropic: ["claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
};

// Check API key availability
export function hasApiKey(provider: ModelProvider): boolean {
  switch (provider) {
    case "openai": return !!OPENAI_API_KEY;
    case "google": return !!GOOGLE_API_KEY;
    case "anthropic": return !!ANTHROPIC_API_KEY;
    default: return false;
  }
}

// Default model selection logic
export function getDefaultModel(): string {
  if (hasApiKey("google")) {
    return "gemini-2.5-pro-preview-05-06"; // Default to Gemini 2.5 Pro if Google key is available
  } else if (hasApiKey("openai")) {
    return "o4-mini"; // Default to o4-mini if only OpenAI key is available
  } else if (hasApiKey("anthropic")) {
    return "claude-3-haiku-20240307"; // Default to Claude 3 Haiku if only Anthropic key is available
  }
  
  throw new Error("No API keys provided. At least one of OPENAI_API_KEY, GOOGLE_API_KEY, or ANTHROPIC_API_KEY must be set.");
}

// Get model provider
export function getModelProvider(model: string): ModelProvider | undefined {
  if (modelCategories.openai.includes(model)) return "openai";
  if (modelCategories.google.includes(model)) return "google";
  if (modelCategories.anthropic.includes(model)) return "anthropic";
  return undefined;
}

// Check if a model is available based on API keys
export function isModelAvailable(model: string): boolean {
  const provider = getModelProvider(model);
  if (!provider) return false; // Model not recognized
  return hasApiKey(provider);
}

// Get available models based on provided API keys
export function getAvailableModels(): Record<string, string> {
  const availableModels: Record<string, string> = {};
  
  // Add models for each provider where API key is available
  if (hasApiKey("openai")) {
    modelCategories.openai.forEach(model => {
      availableModels[model] = modelMapping[model as keyof typeof modelMapping];
    });
  }
  
  if (hasApiKey("google")) {
    modelCategories.google.forEach(model => {
      availableModels[model] = modelMapping[model as keyof typeof modelMapping];
    });
  }
  
  if (hasApiKey("anthropic")) {
    modelCategories.anthropic.forEach(model => {
      availableModels[model] = modelMapping[model as keyof typeof modelMapping];
    });
  }
  
  return availableModels;
}

// Validate environment variable setup
export function validateEnv(): string[] {
  const errors: string[] = [];
  
  // Check if at least one API key is provided
  if (!hasApiKey("openai") && !hasApiKey("google") && !hasApiKey("anthropic")) {
    errors.push("No API keys provided. At least one of OPENAI_API_KEY, GOOGLE_API_KEY, or ANTHROPIC_API_KEY must be set.");
  }
  
  // Add other environment variable validation as needed
  
  return errors;
}

// Get server configuration summary (safe for logging - no API keys)
export function getConfigSummary(): Record<string, any> {
  return {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    host: HOST,
    port: PORT,
    logLevel: LOG_LEVEL,
    providersConfigured: {
      openai: hasApiKey("openai"),
      google: hasApiKey("google"),
      anthropic: hasApiKey("anthropic")
    },
    availableModelCount: Object.keys(getAvailableModels()).length,
    defaultModel: getDefaultModel()
  };
}