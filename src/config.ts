import { z } from "zod";
import dotenv from "dotenv";

// Load .env file from the current working directory (where user runs npx)
// This allows users to place a .env file in their project root if they prefer
dotenv.config({ path: process.cwd() + "/.env" });
// Also load .env from the package's directory (less common for API keys for this tool)
dotenv.config();

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
      "The specific model name from the provider (e.g., 'gemini-1.5-pro-latest', 'gpt-4o-mini', 'claude-3-haiku-20240307')."
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
});

export type CodeReviewToolParams = z.infer<typeof CodeReviewToolParamsSchema>;

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
