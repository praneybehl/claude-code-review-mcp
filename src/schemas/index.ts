import { z } from "zod";

// Input schema for code review tools
export const codeReviewInputSchema = z.object({
  code: z.string().describe("The code to review"),
  filename: z.string().optional().describe("The filename with extension"),
  language: z.string().optional().describe("Programming language"),
  model: z.string().describe("Model ID to use for review"),
  projectContext: z
    .object({
      projectStructure: z.string().optional().describe("Directory structure"),
      relatedFiles: z
        .array(
          z.object({
            name: z.string().describe("Filename with path"),
            language: z.string().optional().describe("File language"),
            content: z.string().describe("File content"),
          })
        )
        .optional()
        .describe("Related code files"),
      commitMessage: z.string().optional().describe("Purpose of changes"),
      dependencies: z
        .record(z.string())
        .optional()
        .describe("Project dependencies"),
    })
    .optional()
    .describe("Additional context"),
});

// Output schema for structured review
export const structuredReviewOutputSchema = z.object({
  review: z
    .object({
      summary: z.string().describe("Overall assessment"),
      quality: z.object({
        strengths: z.array(z.string()).describe("Good aspects"),
        weaknesses: z.array(z.string()).describe("Areas for improvement"),
      }),
      bugs: z.array(
        z.object({
          description: z.string().describe("Issue description"),
          severity: z.enum(["Low", "Medium", "High"]).describe("Impact level"),
          suggestion: z.string().describe("How to fix"),
        })
      ).describe("Identified bugs"),
      improvements: z.array(z.string()).describe("Enhancement suggestions"),
      securityIssues: z.array(z.string()).optional().describe("Security concerns if any"),
    })
    .optional()
    .describe("Present on success"),
  modelUsed: z.string().describe("Human-readable model name"),
  error: z.string().optional().describe("Present on error"),
  availableModels: z
    .record(z.string())
    .optional()
    .describe("Present on error or listModels"),
});

// Output schema for freeform review
export const freeformReviewOutputSchema = z.object({
  reviewText: z.string().optional().describe("Present on success"),
  modelUsed: z.string().describe("Human-readable model name"),
  error: z.string().optional().describe("Present on error"),
  availableModels: z
    .record(z.string())
    .optional()
    .describe("Present on error or listModels"),
});

// Output schema for list models
export const listModelsOutputSchema = z.object({
  availableModels: z.record(z.string()).describe("Model ID to name mapping"),
  modelUsed: z.string().describe("Always 'None' for this tool"),
});

export const listModelsInputSchema = z.object({});

// Type definitions based on Zod schemas
export type CodeReviewInput = z.infer<typeof codeReviewInputSchema>;
export type StructuredReviewOutput = z.infer<typeof structuredReviewOutputSchema>;
export type FreeformReviewOutput = z.infer<typeof freeformReviewOutputSchema>;
export type ListModelsOutput = z.infer<typeof listModelsOutputSchema>;