#!/usr/bin/env node
/**
 * MCP Server for performing code reviews using LLMs.
 * 
 * IMPORTANT: MCP Server logs are written to stderr to keep stdout clean for MCP communication.
 * All console.log/error/warn will output to stderr, preserving stdout exclusively for MCP protocol.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CodeReviewToolParamsSchema, CodeReviewToolParams, isDebugMode } from "./config.js";
import { getGitDiff } from "./git-utils.js";
import { getLLMReview } from "./llm-service.js";
import { CoreMessage } from "ai";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Get package.json data using file system
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packagePath = resolve(__dirname, "../package.json");
const pkg = JSON.parse(readFileSync(packagePath, "utf8"));

// Maximum number of transport connection retry attempts
const MAX_CONNECTION_ATTEMPTS = 3;
const CONNECTION_RETRY_DELAY_MS = 2000;

async function main() {
  console.error("[MCP Server] Initializing Code Reviewer MCP Server...");

  const server = new McpServer({
    name: pkg.name,
    version: pkg.version,
    capabilities: {
      tools: { listChanged: false }, // Tool list is static
    },
  });

  // Register the code review tool
  registerCodeReviewTool(server);

  // Set up the MCP transport with connection retry logic
  await setupTransport(server);
}

/**
 * Registers the code review tool with the MCP server.
 * 
 * @param server - The MCP server instance
 */
function registerCodeReviewTool(server: McpServer) {
  server.tool(
    "perform_code_review",
    "Performs a code review using a specified LLM on git changes. Requires being run from the root of a git repository.",
    CodeReviewToolParamsSchema.shape,
    async (params: CodeReviewToolParams) => {
      try {
        console.error(
          `[MCP Server Tool] Received 'perform_code_review' request. Target: ${params.target}, Provider: ${params.llmProvider}, Model: ${params.modelName}`
        );

        // Step 1: Get the diff from git
        const diffResult = await getGitDiffForReview(params);
        if (diffResult.noChanges) {
          return {
            content: [
              { type: "text", text: "No changes detected for review." },
            ],
          };
        }

        // Step 2: Prepare LLM prompt and get the review
        const reviewResult = await generateLLMReview(params, diffResult.diff);

        return {
          content: [{ type: "text", text: reviewResult }],
          isError: false, // Explicitly set isError
        };
      } catch (error: any) {
        console.error(
          "[MCP Server Tool] Error in 'perform_code_review' tool:",
          error.stack || error.message
        );
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error performing code review: ${error.message}`,
            },
          ],
        };
      }
    }
  );
}

/**
 * Gets the git diff for review based on the provided parameters.
 * 
 * @param params - Code review tool parameters
 * @returns Object with the diff and a flag indicating if there are no changes
 */
async function getGitDiffForReview(params: CodeReviewToolParams): Promise<{ diff: string; noChanges: boolean }> {
  const diff = getGitDiff(params.target, params.diffBase);
  
  if (diff === "No changes found for the specified target.") {
    console.error("[MCP Server Tool] No changes detected for review.");
    return { diff: "", noChanges: true };
  }
  
  if (isDebugMode()) {
    console.error(
      `[MCP Server Tool] Git diff obtained successfully. Length: ${diff.length} chars.`
    );
  }
  
  return { diff, noChanges: false };
}

/**
 * Generates a code review using the specified LLM based on the git diff.
 * 
 * @param params - Code review tool parameters
 * @param diff - The git diff to review
 * @returns The generated code review
 */
async function generateLLMReview(params: CodeReviewToolParams, diff: string): Promise<string> {
  const systemPrompt = `You are an expert code reviewer. Your task is to review the provided code changes (git diff format) and offer constructive feedback.
${params.projectContext ? `Project Context: ${params.projectContext}\n` : ""}
The changes were made as part of the following task: "${params.taskDescription}"
${
  params.reviewFocus
    ? `Please specifically focus your review on: "${params.reviewFocus}"\n`
    : ""
}
Provide your review in a clear, concise, and actionable markdown format. Highlight potential bugs, suggest improvements for readability, maintainability, performance, and adherence to best practices. If you see positive aspects, mention them too. Structure your review logically, perhaps by file or by theme.`;

  const userMessages: CoreMessage[] = [
    {
      role: "user",
      content: `Please review the following code changes (git diff). Ensure your review is thorough and actionable:\n\n\`\`\`diff\n${diff}\n\`\`\``,
    },
  ];

  // Use the provided maxTokens parameter or default value
  const maxTokens = params.maxTokens || 32000;

  const review = await getLLMReview(
    params.llmProvider,
    params.modelName,
    systemPrompt,
    userMessages,
    maxTokens
  );
  
  console.error(`[MCP Server Tool] LLM review generated successfully.`);
  return review;
}

/**
 * Sets up the MCP transport with connection retry logic.
 * 
 * @param server - The MCP server instance
 */
async function setupTransport(server: McpServer) {
  let connectionAttempts = 0;
  let connected = false;

  while (!connected && connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
    connectionAttempts++;
    try {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      
      // Add event handler for disconnect
      transport.onclose = () => {
        console.error("[MCP Server] Transport connection closed unexpectedly.");
        process.exit(1); // Exit process to allow restart by supervisor
      };
      
      connected = true;
      console.error(
        "[MCP Server] Code Reviewer MCP Server is running via stdio and connected to transport."
      );
    } catch (error) {
      console.error(
        `[MCP Server] Connection attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS} failed:`,
        error
      );
      
      if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
        console.error(`[MCP Server] Retrying in ${CONNECTION_RETRY_DELAY_MS/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, CONNECTION_RETRY_DELAY_MS));
      } else {
        console.error("[MCP Server] Maximum connection attempts exceeded. Exiting.");
        process.exit(1); 
      }
    }
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.error("[MCP Server] Received SIGINT. Shutting down...");
  // Perform any cleanup if necessary
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.error("[MCP Server] Received SIGTERM. Shutting down...");
  // Perform any cleanup if necessary
  process.exit(0);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("[MCP Server] Unhandled Promise Rejection:", reason);
  // Continue running but log the error
});

main().catch((error) => {
  console.error(
    "[MCP Server] Unhandled fatal error in main execution:",
    error.stack || error.message
  );
  process.exit(1);
});