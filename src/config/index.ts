import { config } from "dotenv";
config();

// Model Mapping
export const modelMapping = {
  // OpenAI models
  "gpt-4.1": "OpenAI GPT-4.1",
  "o4-mini": "OpenAI O4 Mini",
  "o3-mini": "OpenAI O3 Mini",
  
  // Google models
  "gemini-2.5-pro-preview-05-06": "Google Gemini 2.5 Pro",
  "gemini-2.5-flash-preview-04-17": "Google Gemini 2.5 Flash",
};

// Default model selection logic
export function getDefaultModel(): string {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGoogle = !!process.env.GOOGLE_API_KEY;

  if (hasGoogle) {
    return "gemini-2.5-pro-preview-05-06"; // Default to Gemini 2.5 Pro if Google key is available
  } else if (hasOpenAI) {
    return "o4-mini"; // Default to o4-mini if only OpenAI key is available
  }
  
  throw new Error("No API keys provided. At least one of OPENAI_API_KEY or GOOGLE_API_KEY must be set.");
}

// Get available models
export function getAvailableModels(): Record<string, string> {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGoogle = !!process.env.GOOGLE_API_KEY;
  
  const availableModels: Record<string, string> = {};
  
  if (hasOpenAI) {
    availableModels["gpt-4.1"] = modelMapping["gpt-4.1"];
    availableModels["o4-mini"] = modelMapping["o4-mini"];
    availableModels["o3-mini"] = modelMapping["o3-mini"];
  }
  
  if (hasGoogle) {
    availableModels["gemini-2.5-pro-preview-05-06"] = modelMapping["gemini-2.5-pro-preview-05-06"];
    availableModels["gemini-2.5-flash-preview-04-17"] = modelMapping["gemini-2.5-flash-preview-04-17"];
  }
  
  return availableModels;
}

// Check if a model is available
export function isModelAvailable(model: string): boolean {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGoogle = !!process.env.GOOGLE_API_KEY;
  
  // Check if model exists in our mapping
  if (!modelMapping[model as keyof typeof modelMapping]) {
    return false;
  }
  
  // Check if API key is available for the selected model
  const isOpenAIModel = ["gpt-4.1", "o4-mini", "o3-mini"].includes(model);
  const isGoogleModel = ["gemini-2.5-pro-preview-05-06", "gemini-2.5-flash-preview-04-17"].includes(model);
  
  return (isOpenAIModel && hasOpenAI) || (isGoogleModel && hasGoogle);
}

// Get model provider
export function getModelProvider(model: string): "openai" | "google" {
  const isOpenAIModel = ["gpt-4.1", "o4-mini", "o3-mini"].includes(model);
  if (isOpenAIModel) return "openai";
  return "google";
}

// Server configuration
export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
export const HOST = process.env.HOST || "127.0.0.1";