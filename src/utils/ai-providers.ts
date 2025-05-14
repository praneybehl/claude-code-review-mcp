import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { generateObject, generateText } from "ai";
import type { LanguageModelV1 } from "ai";
import { 
  structuredReviewOutputSchema, 
  freeformReviewOutputSchema
} from "../schemas/index.js";
import type { 
  CodeReviewInput,
  StructuredReviewOutput,
  FreeformReviewOutput
} from "../schemas/index.js";
import { getModelProvider, modelMapping, isModelAvailable } from "../config/index.js";

// Create prompts for the AI models
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

// Get the appropriate model
function getModel(modelId: string): LanguageModelV1 {
  if (!isModelAvailable(modelId)) {
    throw new Error(`Model ${modelId} is not available.`);
  }

  const provider = getModelProvider(modelId);
  
  if (provider === "openai") {
    return openai(modelId);
  } else {
    return google(modelId);
  }
}

// Generate a structured review
export async function generateStructuredReview(input: CodeReviewInput): Promise<StructuredReviewOutput> {
  try {
    if (!isModelAvailable(input.model)) {
      return {
        modelUsed: "None",
        error: `Model ${input.model} is not available or the required API key is not provided.`,
        availableModels: Object.fromEntries(
          Object.entries(modelMapping).filter(([id]) => isModelAvailable(id))
        ),
      };
    }

    const model = getModel(input.model);
    const prompt = createStructuredReviewPrompt(input);

    const result = await generateObject({
      model,
      schema: structuredReviewOutputSchema.omit({ modelUsed: true, error: true, availableModels: true }).shape.review,
      prompt,
    });

    return {
      review: result.object,
      modelUsed: modelMapping[input.model as keyof typeof modelMapping] || input.model,
    };
  } catch (error) {
    return {
      modelUsed: "None",
      error: `Error generating review: ${(error as Error).message}`,
      availableModels: Object.fromEntries(
        Object.entries(modelMapping).filter(([id]) => isModelAvailable(id))
      ),
    };
  }
}

// Generate a freeform review
export async function generateFreeformReview(input: CodeReviewInput): Promise<FreeformReviewOutput> {
  try {
    if (!isModelAvailable(input.model)) {
      return {
        modelUsed: "None",
        error: `Model ${input.model} is not available or the required API key is not provided.`,
        availableModels: Object.fromEntries(
          Object.entries(modelMapping).filter(([id]) => isModelAvailable(id))
        ),
      };
    }

    const model = getModel(input.model);
    const prompt = createFreeformReviewPrompt(input);

    // Use generateText instead of generateObject for freeform content
    const { text } = await generateText({
      model,
      prompt,
    });

    return {
      reviewText: text,
      modelUsed: modelMapping[input.model as keyof typeof modelMapping] || input.model,
    };
  } catch (error) {
    return {
      modelUsed: "None",
      error: `Error generating review: ${(error as Error).message}`,
      availableModels: Object.fromEntries(
        Object.entries(modelMapping).filter(([id]) => isModelAvailable(id))
      ),
    };
  }
}