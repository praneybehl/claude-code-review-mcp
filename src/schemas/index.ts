import { z } from "zod";

/**
 * Schema definitions for MCP tool inputs and outputs
 * Follows requirements outlined in the specification document
 */

// Related file schema for project context
const relatedFileSchema = z.object({
  name: z.string().describe("Filename with path"),
  language: z.string().optional().describe("File language"),
  content: z.string().describe("File content"),
});

// Project context schema 
const projectContextSchema = z.object({
  projectStructure: z.string().optional().describe("Directory structure"),
  relatedFiles: z
    .array(relatedFileSchema)
    .optional()
    .describe("Related code files"),
  commitMessage: z.string().optional().describe("Purpose of changes"),
  dependencies: z
    .record(z.string())
    .optional()
    .describe("Project dependencies"),
});

// Input schema for code review tools
export const codeReviewInputSchema = z.object({
  code: z.string().describe("The code to review"),
  filename: z.string().optional().describe("The filename with extension"),
  language: z.string().optional().describe("Programming language"),
  model: z.string().describe("Model ID to use for review"),
  projectContext: projectContextSchema
    .optional()
    .describe("Additional context"),
});

// Bug schema for structured review
const bugSchema = z.object({
  description: z.string().describe("Issue description"),
  severity: z.enum(["Low", "Medium", "High"]).describe("Impact level"),
  suggestion: z.string().describe("How to fix"),
});

// Quality schema for structured review
const qualitySchema = z.object({
  strengths: z.array(z.string()).describe("Good aspects"),
  weaknesses: z.array(z.string()).describe("Areas for improvement"),
});

// Review schema for structured output
const reviewSchema = z.object({
  summary: z.string().describe("Overall assessment"),
  quality: qualitySchema,
  bugs: z.array(bugSchema).describe("Identified bugs"),
  improvements: z.array(z.string()).describe("Enhancement suggestions"),
  securityIssues: z.array(z.string()).optional().describe("Security concerns if any"),
});

// Output schema for structured review
export const structuredReviewOutputSchema = z.object({
  review: reviewSchema.optional().describe("Present on success"),
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

// Input schema for list models
export const listModelsInputSchema = z.object({});

// Output schema for list models
export const listModelsOutputSchema = z.object({
  availableModels: z.record(z.string()).describe("Model ID to name mapping"),
  modelUsed: z.string().describe("Always 'None' for this tool"),
});

// Type definitions based on Zod schemas
export type RelatedFile = z.infer<typeof relatedFileSchema>;
export type ProjectContext = z.infer<typeof projectContextSchema>;
export type CodeReviewInput = z.infer<typeof codeReviewInputSchema>;
export type Bug = z.infer<typeof bugSchema>;
export type Quality = z.infer<typeof qualitySchema>;
export type Review = z.infer<typeof reviewSchema>;
export type StructuredReviewOutput = z.infer<typeof structuredReviewOutputSchema>;
export type FreeformReviewOutput = z.infer<typeof freeformReviewOutputSchema>;
export type ListModelsInput = z.infer<typeof listModelsInputSchema>;
export type ListModelsOutput = z.infer<typeof listModelsOutputSchema>;