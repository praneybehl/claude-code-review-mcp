#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CodeReviewToolParamsSchema, CodeReviewToolParams } from "./config.js";
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

async function main() {
  console.error("[MCP Server] Initializing Code Reviewer MCP Server...");

  const server = new McpServer({
    name: pkg.name,
    version: pkg.version,
    capabilities: {
      tools: { listChanged: false }, // Tool list is static
    },
  });

  server.tool(
    "perform_code_review",
    "Performs a code review using a specified LLM on git changes. Requires being run from the root of a git repository.",
    CodeReviewToolParamsSchema.shape,
    async (params: CodeReviewToolParams) => {
      try {
        console.error(
          `[MCP Server Tool] Received 'perform_code_review' request. Target: ${params.target}, Provider: ${params.llmProvider}, Model: ${params.modelName}`
        );

        const diff = getGitDiff(params.target, params.diffBase);
        if (diff === "No changes found for the specified target.") {
          console.error("[MCP Server Tool] No changes detected for review.");
          return {
            content: [
              { type: "text", text: "No changes detected for review." },
            ],
          };
        }
        console.error(
          `[MCP Server Tool] Git diff obtained successfully. Length: ${diff.length} chars.`
        );

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

        const review = await getLLMReview(
          params.llmProvider,
          params.modelName,
          systemPrompt,
          userMessages
        );
        console.error(`[MCP Server Tool] LLM review generated successfully.`);

        return {
          content: [{ type: "text", text: review }],
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

  const transport = new StdioServerTransport();
  try {
    await server.connect(transport);
    // console.error is used for logs that should not interfere with MCP's stdout communication
    console.error(
      "[MCP Server] Code Reviewer MCP Server is running via stdio and connected to transport."
    );
  } catch (error) {
    console.error(
      "[MCP Server] Failed to connect MCP server to stdio transport:",
      error
    );
    process.exit(1); // Exit if transport connection fails
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

main().catch((error) => {
  console.error(
    "[MCP Server] Unhandled fatal error in main execution:",
    error.stack || error.message
  );
  process.exit(1);
});
