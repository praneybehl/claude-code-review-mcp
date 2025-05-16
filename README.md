# @vibesnipe/code-review-mcp

**Version: 1.0.0**

An MCP (Model Context Protocol) server that provides a powerful tool to perform code reviews using various Large Language Models (LLMs). This server is designed to be seamlessly integrated with AI coding assistants like Anthropic's Claude Code, Cursor, Windsurf, or other MCP-compatible clients.

> **Note:** This tool was initially created for Claude Code but has since been expanded to support other AI IDEs and Claude Desktop. See the integration guides for [Claude Code](#integration-with-claude-code), [Cursor](#cursor-integration), and [Windsurf](#windsurf-integration).

It analyzes `git diff` output for staged changes, differences from HEAD, or differences between branches, providing contextualized reviews based on your task description and project details.

## Features

-   Reviews git diffs (staged changes, current HEAD, branch differences).
-   Integrates with Google Gemini, OpenAI, and Anthropic models through the Vercel AI SDK.
-   Allows specification of task description, review focus, and overall project context for tailored reviews.
-   Outputs reviews in clear, actionable markdown format.
-   Designed to be run from the root of any Git repository you wish to analyze.
-   Easily installable and runnable via `npx` for immediate use.

## Compatibility

-   **Node.js**: Version 18 or higher is required.
-   **Operating Systems**: Works on Windows, macOS, and Linux.
-   **Git**: Version 2.20.0 or higher recommended.

## Prerequisites

-   **Node.js**: Version 18 or higher is required.
-   **Git**: Must be installed and accessible in your system's PATH. The server executes `git` commands.
-   **API Keys for LLMs**: You need API keys for the LLM providers you intend to use. These should be set as environment variables:
    -   `GOOGLE_API_KEY` for Google models.
    -   `OPENAI_API_KEY` for OpenAI models.
    -   `ANTHROPIC_API_KEY` for Anthropic models.
    These can be set globally in your environment or, conveniently, in a `.env` file placed in the root of the project you are currently reviewing. The server will automatically try to load it.

## Installation & Usage

The primary way to use this server is with `npx`, which ensures you're always using the latest version without needing a global installation.

### Recommended: Using with `npx`

1.  **Navigate to Your Project:**
    Open your terminal and change to the root directory of the Git repository you want to review.
    ```bash
    cd /path/to/your-git-project
    ```

2.  **Run the MCP Server:**
    Execute the following command:
    ```bash
    npx -y @vibesnipe/code-review-mcp
    ```

    This command will download (if not already cached) and run the `@vibesnipe/code-review-mcp` server. You should see output in your terminal similar to:
    `[MCP Server] Code Reviewer MCP Server is running via stdio and connected to transport.`
    The server is now running and waiting for an MCP client (like Claude Code, Cursor, or Windsurf) to connect.



### Installing via Smithery

To install code-review-mcp for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@praneybehl/code-review-mcp):

```bash
npx -y @smithery/cli install @praneybehl/code-review-mcp --client claude
```


## Integration with Claude Code

Once the `claude-code-review-mcp` server is running (ideally via `npx` from your project's root):

1.  **Add as an MCP Server in Claude Code:**
    In a separate terminal where Claude Code is running (or will be run), configure it to use this MCP server.
    The command to run the server (as used by Claude Code) would be `code-review-mcp` if installed globally and in PATH, or the `npx ...` command if you prefer Claude Code to always fetch it.

    To add it to Claude Code:
    ```bash
    claude mcp add code-reviewer -s <user|local> -e GOOGLE_API_KEY="key" -- code-review-mcp 
    ```
    If you want Claude Code to use `npx` (which is a good practice to ensure version consistency if you don't install globally):
    ```bash
    claude mcp add code-reviewer -s <user|local> -e GOOGLE_API_KEY="key" -- npx -y @vibesnipe/code-review-mcp
    ```
    This tells Claude Code how to launch the MCP server when the "code-reviewer" toolset is requested. This configuration can be project-specific (saved in `.claude/.mcp.json` in your project) or user-specific (global Claude Code settings).

2.  **Use Smart Slash Commands in Claude Code:**
    Create custom slash command files in your project's `.claude/commands/` directory to easily invoke the review tool. The package includes several example commands in the `examples/claude-commands/` directory that you can copy to your project.

    These improved slash commands don't require you to manually specify task descriptions or project context - they leverage Claude Code's existing knowledge of your project and the current task you're working on.

    Example invocation using a slash command in Claude Code:
    ```
    claude > /project:review-staged-claude
    ```

    No additional arguments needed! Claude will understand what you're currently working on and use that as context for the review.

    For commands that require arguments (like `review-branch-custom-gemini.md` which uses a custom branch name), you can pass them directly after the command:
    ```
    claude > /project:review-branch-custom-gemini main
    ```
    This will pass "main" as the $ARGUMENTS_BASE_BRANCH parameter.

## Integration with Modern AI IDEs

### Cursor Integration

Cursor is a popular AI-powered IDE based on VS Code that supports MCP servers. Here's how to integrate the code review MCP server with Cursor:

1. **Configure Cursor's Rules for Code Review**:
   
   Create or open the `.cursor/rules/project.mdc` file in your project and add the following section:

   ```markdown
   ## Slash Commands

   /review-staged: Use the perform_code_review tool from the code-reviewer MCP server to review staged changes. Use anthropic provider with claude-3-7-sonnet-20250219 model. Base the task description on our current conversation context and focus on code quality and best practices.

   /review-head: Use the perform_code_review tool from the code-reviewer MCP server to review all uncommitted changes (HEAD). Use openai provider with o3 model. Base the task description on our current conversation context and focus on code quality and best practices.

   /review-security: Use the perform_code_review tool from the code-reviewer MCP server to review staged changes. Use anthropic provider with claude-3-5-sonnet-20241022 model. Base the task description on our current conversation context and specifically focus on security vulnerabilities, input validation, and secure coding practices.
   ```

2. **Add the MCP Server in Cursor**:
   
   - Open Cursor settings
   - Navigate to the MCP Servers section
   - Add a new MCP server with the following JSON configuration:
   ```json
   "code-reviewer": {
     "command": "npx",
     "args": ["-y", "@vibesnipe/code-review-mcp"],
     "env": {
       "GOOGLE_API_KEY": "your-google-api-key",
       "OPENAI_API_KEY": "your-openai-api-key",
       "ANTHROPIC_API_KEY": "your-anthropic-api-key"
     }
   }
   ```

4. **Using the Commands**:
   
   In Cursor's AI chat interface, you can now simply type:
   ```
   /review-staged
   ```
   And Cursor will use the claude-code-review-mcp server to perform a code review of your staged changes.

### Windsurf Integration

Windsurf (formerly Codeium) is another advanced AI IDE that supports custom workflows via slash commands. Here's how to integrate with Windsurf:

1. **Configure the MCP Server in Windsurf**:
   
   - Open Windsurf
   - Click on the Customizations icon in the top right of Cascade
   - Navigate to the MCP Servers panel
   - Add a new MCP server with the following JSON configuration:
   ```json
   "code-reviewer": {
     "command": "npx",
     "args": ["-y", "@vibesnipe/code-review-mcp"],
     "env": {
       "GOOGLE_API_KEY": "your-google-api-key",
       "OPENAI_API_KEY": "your-openai-api-key",
       "ANTHROPIC_API_KEY": "your-anthropic-api-key"
     }
   }
   ```

3. **Create Workflows for Code Review**:
   
   Windsurf supports workflows that can be invoked via slash commands. Create a file in `.windsurf/workflows/review-staged.md`:

   ```markdown
   # Review Staged Changes
   
   Perform a code review on the currently staged changes in the repository.
   
   ## Step 1
   
   Use the perform_code_review tool from the code-reviewer MCP server with the following parameters:
   ```
   {
     "target": "staged",
     "llmProvider": "anthropic",
     "modelName": "claude-3-7-sonnet-20250219",
     "taskDescription": "The task I am currently working on in this codebase",
     "reviewFocus": "General code quality, security best practices, and performance considerations",
     "projectContext": "This project is being developed in Windsurf. Please review the code carefully for any issues."
   }
   ```
   ```

   Similarly, create workflows for other review types as needed.

4. **Using the Workflows**:
   
   In Windsurf's Cascade interface, you can invoke these workflows with:
   ```
   /review-staged
   ```

   Windsurf will then execute the workflow, which will use the claude-code-review-mcp server to perform the code review.

## Tool Provided by this MCP Server

### `perform_code_review`

**Description:**
Performs a code review using a specified Large Language Model on git changes within the current Git repository. This tool must be run from the root directory of the repository being reviewed.

**Input Schema (Parameters):**

The tool expects parameters matching the `CodeReviewToolParamsSchema`:

-   `target` (enum: `'staged'`, `'HEAD'`, `'branch_diff'`):
    Specifies the set of changes to review.
    -   `'staged'`: Reviews only the changes currently staged for commit.
    -   `'HEAD'`: Reviews uncommitted changes (both staged and unstaged) against the last commit.
    -   `'branch_diff'`: Reviews changes between a specified base branch/commit and the current HEAD. Requires `diffBase` parameter.
-   `taskDescription` (string):
    A clear and concise description of the task, feature, or bugfix that led to the code changes. This provides crucial context for the LLM reviewer. (e.g., "Implemented password reset functionality via email OTP.")
-   `llmProvider` (enum: `'google'`, `'openai'`, `'anthropic'`):
    The Large Language Model provider to use for the review.
-   `modelName` (string):
    The specific model name from the chosen provider. Examples:
    -   Google: `'gemini-2.5-pro-preview-05-06'`, `'gemini-2.5-flash-preview-04-17'`
        *(Ref: https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai#model-capabilities)*
    -   OpenAI: `'o4-mini'`, `'gpt-4.1'`, `'gpt-4.1-mini'`, `'o3'`
        *(Ref: https://ai-sdk.dev/providers/ai-sdk-providers/openai#model-capabilities)*
    -   Anthropic: `'claude-3-7-sonnet-20250219'`, `'claude-3-5-sonnet-20241022'`
        *(Ref: https://ai-sdk.dev/providers/ai-sdk-providers/anthropic#model-capabilities)*
    Ensure the model selected is available via the Vercel AI SDK and your API key has access.
    
    **Note:** Model names often change as providers release new versions. Always check the latest documentation from your provider and update the model names accordingly.
-   `reviewFocus` (string, optional but recommended):
    Specific areas, concerns, or aspects you want the LLM to concentrate on during the review. (e.g., "Focus on thread safety in concurrent operations.", "Pay special attention to input validation and sanitization.", "Check for adherence to our internal style guide for React components.").
-   `projectContext` (string, optional but recommended):
    General background information about the project, its architecture, key libraries, coding standards, or any other context that would help the LLM provide a more relevant and insightful review. (e.g., "This is a high-performance microservice using Rust and Actix. Low latency is critical.", "The project follows Clean Architecture principles. Ensure new code aligns with this.").
-   `diffBase` (string, optional):
    **Required if `target` is `'branch_diff'**. Specifies the base branch (e.g., `'main'`, `'develop'`) or a specific commit SHA to compare the current HEAD against.
-   `maxTokens` (number, optional):
    Maximum number of tokens to use for the LLM response. Defaults to 32000 if not specified. Use this parameter to optimize for faster, less expensive responses (lower value) or more comprehensive reviews (higher value).
    **Note**: In v0.11.0, the default was reduced from 60000 to 32000 tokens to better balance cost and quality.

**Output:**

-   If successful: A JSON object with `isError: false` and a `content` array containing a single text item. The `text` field holds the code review generated by the LLM in markdown format.
-   If an error occurs: A JSON object with `isError: true` and a `content` array. The `text` field will contain an error message describing the issue.

## Environment Variables

For the LLM integration to work, the `claude-code-review-mcp` server (the process started by `npx` or `claude-code-review-mcp`) needs access to the respective API keys.

Set these in your shell environment or place them in a `.env` file in the **root directory of the project you are reviewing**:

-   **For Google Models:**
    `GOOGLE_API_KEY="your_google_api_key"`

-   **For OpenAI Models:**
    `OPENAI_API_KEY="your_openai_api_key"`

-   **For Anthropic Models:**
    `ANTHROPIC_API_KEY="your_anthropic_api_key"`

The server will automatically load variables from a `.env` file found in the current working directory (i.e., your project's root) or you can configure them directly in the MCP server configuration as shown in the examples above.

## Smart Slash Commands for Claude Code

The package includes several improved slash commands in the `examples/claude-commands/` directory that you can copy to your project's `.claude/commands/` directory. These commands take advantage of Claude Code's understanding of your project context and current task, eliminating the need for manual input.

### Available Slash Commands

| Command File | Description |
|--------------|-------------|
| `review-staged-claude.md` | Reviews staged changes using Claude 3.5 Sonnet |
| `review-staged-openai.md` | Reviews staged changes using OpenAI GPT-4.1 |
| `review-staged-gemini.md` | Reviews staged changes using Google Gemini 2.5 Pro |
| `review-head-claude.md` | Reviews all uncommitted changes using Claude 3.7 Sonnet |
| `review-head-openai.md` | Reviews all uncommitted changes using OpenAI O3 |
| `review-head-gemini.md` | Reviews all uncommitted changes using Google Gemini 2.5 Pro |
| `review-branch-main-claude.md` | Reviews changes from main branch using Claude 3.7 Sonnet |
| `review-branch-develop-openai.md` | Reviews changes from develop branch using OpenAI O4-mini |
| `review-branch-custom-gemini.md` | Reviews changes from a specified branch using Google Gemini 2.5 Flash |
| `review-staged-security-claude.md` | Security-focused review of staged changes using Claude 3.5 Sonnet |
| `review-staged-performance-openai.md` | Performance-focused review of staged changes using OpenAI O3 |
| `review-staged-maintainability-gemini.md` | Maintainability-focused review of staged changes using Google Gemini 2.5 Flash |

To use these commands:

1. Copy the desired command files from the `examples/claude-commands/` directory to your project's `.claude/commands/` directory
2. Invoke the command in Claude Code with `/project:command-name` (e.g., `/project:review-staged-claude`)

These commands automatically use Claude's knowledge of your current task and project context, eliminating the need for lengthy manual arguments.

## Security Considerations

- **API Key Handling**: API keys for LLM providers are sensitive credentials. This tool accesses them from environment variables or `.env` files, but does not store or transmit them beyond the necessary API calls. Consider using a secure environment variable manager for production environments.
  
- **Git Repository Analysis**: The tool analyzes your local Git repository contents. It executes Git commands and reads diff output, but does not transmit your entire codebase to the LLM - only the specific changes being reviewed.
  
- **Code Privacy**: When sending code for review to external LLM providers, be mindful of:
  - Sensitive information in code comments or strings
  - Proprietary algorithms or trade secrets
  - Authentication credentials or API keys in config files
  
- **Branch Name Sanitization**: To prevent command injection, branch names are sanitized before being used in Git commands. However, it's still good practice to avoid using unusual characters in branch names.

## Development (for the `@vibesnipe/code-review-mcp` package itself)

If you are contributing to or modifying the `@vibesnipe/code-review-mcp` package:

1.  **Clone the Monorepo:**
    Ensure you have the repo cloned.
2.  **Navigate to Package:**
    ```bash
    cd /path/to/claude-code-review-mcp
    ```
3.  **Install Dependencies:**
    ```bash
    pnpm install
    ```
4.  **Run in Development Mode:**
    This uses `tsx` for hot-reloading TypeScript changes.
    ```bash
    pnpm dev
    ```
    The server will start and log to `stderr`.

5.  **Testing with Claude Code (Local Development):**
    You'll need to tell Claude Code where your local development server script is:
    ```bash
    # From any directory where you use Claude Code
    claude mcp add local-code-reviewer "node /path/to/claude-code-review-mcp/src/index.ts" --interpreter=tsx
    ```
    Now, when Claude Code needs the "local-code-reviewer", it will execute your source `index.ts` using `tsx`. Remember to replace `/path/to/claude-code-review-mcp/` with the actual absolute path to your repo.

## Building for Production/Publishing

From the package directory:
```bash
pnpm build
```
This compiles TypeScript to JavaScript in the `dist` directory. The `prepublishOnly` script in `package.json` ensures this command is run automatically before publishing the package to npm.

## Troubleshooting

-   **"Current directory is not a git repository..."**: Ensure you are running `npx @vibesnipe/code-review-mcp` (or the global command) from the root directory of a valid Git project.
-   **"API key for ... is not configured"**: Make sure the relevant environment variable (e.g., `OPENAI_API_KEY`) is set in the shell where you launched the MCP server OR in a `.env` file in your project's root.
-   **"Failed to get git diff. Git error: ..."**: This indicates an issue with the `git diff` command.
    -   Check if `git` is installed and in your PATH.
    -   Verify that the `target` and `diffBase` (if applicable) are valid for your repository.
    -   The error message from `git` itself should provide more clues.
-   **LLM API Errors**: Errors from the LLM providers (e.g., rate limits, invalid model name, authentication issues) will be passed through. Check the error message for details from the specific LLM API.
-   **Claude Code MCP Issues**: If Claude Code isn't finding or launching the server, double-check your `claude mcp add ...` command and ensure the command specified for the MCP server is correct and executable. Use `claude mcp list` to verify.
-   **Cursor MCP Server Issues**: If Cursor doesn't recognize the MCP server, make sure it's properly added in the settings with the correct configuration.
-   **Windsurf Workflow Errors**: If Windsurf workflows are not executing correctly, check that:
    -   The workflow files are properly formatted and located in the `.windsurf/workflows/` directory
    -   The MCP server is correctly configured in Windsurf's MCP Server panel
    -   You have the necessary API keys set up in your environment

## License

MIT License - Copyright (c) Praney Behl
