import { z } from "zod";
import dotenv from "dotenv";

/**
 * Load environment variables in order of precedence:
 * 1. First load from the current working directory (where user runs npx)
 *    This allows users to place a .env file in their project root with their API keys
 * 2. Then load from the package's directory as a fallback (less common)
 * Variables from step 1 will take precedence over those from step 2.
 */
dotenv.config({ path: process.cwd() + "/.env" });
dotenv.config();

// Log level for debugging output
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

export const LLMProviderEnum = z.enum(["google", "openai", "anthropic"]);
export type LLMProvider = z.infer<typeof LLMProviderEnum>;

export const ReviewTargetEnum = z.enum(["staged", "HEAD", "branch_diff"]);
export type ReviewTarget = z.infer<typeof ReviewTargetEnum>;

export const CodeReviewToolParamsSchema = z.object({
  target: ReviewTargetEnum.describe(
    "The git target to review (e.g., 'staged', 'HEAD', or 'branch_diff')."
  ),
  taskDescription: z
    .string()
    .min(1)
    .describe(
      "Description of the task/feature/bugfix that led to these code changes."
    ),
  llmProvider: LLMProviderEnum.describe(
    "The LLM provider to use (google, openai, anthropic)."
  ),
  modelName: z
    .string()
    .min(1)
    .describe(
      "The specific model name from the provider (e.g., 'gemini-2.5-pro-preview-05-06', 'o4-mini', 'claude-3-7-sonnet-20250219')."
    ),
  reviewFocus: z
    .string()
    .optional()
    .describe(
      "Specific areas or aspects to focus the review on (e.g., 'security vulnerabilities', 'performance optimizations', 'adherence to SOLID principles')."
    ),
  projectContext: z
    .string()
    .optional()
    .describe(
      "General context about the project, its architecture, or coding standards."
    ),
  diffBase: z
    .string()
    .optional()
    .describe(
      "For 'branch_diff' target, the base branch or commit SHA to compare against (e.g., 'main', 'develop', 'specific-commit-sha'). Required if target is 'branch_diff'."
    ),
  maxTokens: z
    .number()
    .positive()
    .optional()
    .describe(
      "Maximum number of tokens to use for the LLM response. Defaults to 32000 if not specified."
    ),
});

export type CodeReviewToolParams = z.infer<typeof CodeReviewToolParamsSchema>;

/**
 * Gets the appropriate API key for the specified LLM provider.
 * For Google, the primary key name is GOOGLE_API_KEY with GEMINI_API_KEY as fallback.
 * 
 * @param provider - The LLM provider (google, openai, anthropic)
 * @returns The API key or undefined if not found
 */
export function getApiKey(provider: LLMProvider): string | undefined {
  switch (provider) {
    case "google":
      return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    default:
      // Should not happen due to Zod validation
      console.warn(
        `[MCP Server Config] Attempted to get API key for unknown provider: ${provider}`
      );
      return undefined;
  }
}

/**
 * Determines whether to log verbose debug information.
 * Set the LOG_LEVEL environment variable to 'debug' for verbose output.
 */
export function isDebugMode(): boolean {
  return LOG_LEVEL.toLowerCase() === 'debug';
}
