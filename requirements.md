# `claude-code-review-mcp` Requirements Document

## Project Overview

`claude-code-review-mcp` is an MCP (Model Context Protocol) server that provides code review functionality using OpenAI and Google models. It serves as a "second opinion" tool for code review that can be used with any MCP client, including Claude Code, Claude Desktop, Cursor, and Windsurf.

## Core Requirements

### Package Identification

- **Name**: `claude-code-review-mcp`
- **Description**: "An MCP server for code reviews using OpenAI and Google models"
- **Version**: Start with 0.1.0, following semantic versioning

### Execution Methods

The server must support the following execution methods:

1. **Via npx with API key**:
   ```bash
   OPENAI_API_KEY=<your-openai-key> npx -y claude-code-review-mcp
   ```

2. **Via npx with Google API key**:
   ```bash
   GOOGLE_API_KEY=<your-google-key> npx -y claude-code-review-mcp
   ```

3. **Via configuration in MCP clients**:
   ```json
   "claude-code-review-mcp": {
     "command": "npx",
     "args": ["-y", "claude-code-review-mcp"],
     "env": {
       "OPENAI_API_KEY": "your-openai-key",
       "GOOGLE_API_KEY": "your-google-key"
     }
   }
   ```

4. **Support for both keys simultaneously**:
   ```bash
   OPENAI_API_KEY=<your-openai-key> GOOGLE_API_KEY=<your-google-key> npx -y claude-code-review-mcp
   ```

### Supported LLM Providers and Models

1. **OpenAI Models**:
   - `gpt-4.1` - OpenAI gpt-4.1
   - `o4-mini` - OpenAI o4-mini
   - `o3-mini` - OpenAI o3-miin

2. **Google Models**:
   - `gemini-2.5-pro-preview-05-06` - Google Gemini 2.5 Pro
   - `gemini-2.5-flash-preview-04-17` - Google Gemini 2.5 Flash

3. **Default Model**:
   - If both API keys are provided, default to `gemini-2.5-pro-preview-05-06` as it offers good balance of speed and quality
   - If only Google API key is provided, default to `gemini-2.5-pro-preview-05-06`
   - If only OpenAI API key is provided, default to `o4-mini`

### API Keys and Configuration

1. **Environment Variable Support**:
   - `OPENAI_API_KEY` - for OpenAI models
   - `GOOGLE_API_KEY` - for Google models
   - `PORT` - optional, defaults to 3000
   - `HOST` - optional, defaults to 127.0.0.1

2. **Configuration Flexibility**:
   - Server must work when at least one of the API keys is provided
   - Server must clearly indicate which models are available based on provided keys
   - Server must reject requests for models when the corresponding API key is not provided

### MCP Server Tools

The server must provide exactly three tools:

1. **`reviewCodeStructured`**:
   - Provides detailed, structured code review feedback
   - Uses Zod schema for structured output

2. **`reviewCodeFreeform`**:
   - Provides narrative code review in free-form text
   - Better for general impressions and conversational feedback

3. **`listModels`**:
   - Lists all available models based on provided API keys
   - Includes model IDs and human-readable names

### Input Schema

All review tools must accept the following input schema:

```typescript
{
  code: string;  // Required: The code to review
  filename?: string;  // Optional: The filename with extension
  language?: string;  // Optional: Programming language
  model: string;  // Required: Model ID to use for review
  projectContext?: {  // Optional: Additional context
    projectStructure?: string;  // Directory structure
    relatedFiles?: Array<{  // Related code files
      name: string;  // Filename with path
      language?: string;  // File language
      content: string;  // File content
    }>;
    commitMessage?: string;  // Purpose of changes
    dependencies?: Record<string, string>;  // Project dependencies
  }
}
```

### Output Schema

1. **Structured Review Output**:
   ```typescript
   {
     review?: {  // Present on success
       summary: string;  // Overall assessment
       quality: {
         strengths: string[];  // Good aspects
         weaknesses: string[];  // Areas for improvement
       };
       bugs: Array<{
         description: string;  // Issue description
         severity: "Low" | "Medium" | "High";  // Impact level
         suggestion: string;  // How to fix
       }>;
       improvements: string[];  // Enhancement suggestions
       securityIssues?: string[];  // Security concerns if any
     };
     modelUsed: string;  // Human-readable model name
     error?: string;  // Present on error
     availableModels?: Record<string, string>;  // Present on error or listModels
   }
   ```

2. **Freeform Review Output**:
   ```typescript
   {
     reviewText?: string;  // Present on success
     modelUsed: string;  // Human-readable model name
     error?: string;  // Present on error
     availableModels?: Record<string, string>;  // Present on error or listModels
   }
   ```

3. **List Models Output**:
   ```typescript
   {
     availableModels: Record<string, string>;  // Model ID to name mapping
     modelUsed: string;  // Always "None" for this tool
   }
   ```

### Error Handling

1. **API Key Errors**:
   - Graceful handling when required API keys are missing
   - Clear error messages with instructions on how to provide keys

2. **Model Selection Errors**:
   - When requested model is not available, return error with list of available models
   - Suggest best alternative model based on what's available

3. **Rate Limiting and API Errors**:
   - Handle provider rate limits and API errors gracefully
   - Provide helpful error messages that don't expose API keys or sensitive information

### Logging and Feedback

1. **Startup Logging**:
   - Log available models on startup
   - Log server address and port
   - Do not log API keys or sensitive information

2. **Request Logging**:
   - Log basic request information (tool, model)
   - Do not log full code content for privacy reasons
   - Log errors in a useful format for debugging

### Performance and Resources

1. **Startup Time**:
   - Fast startup time (<2 seconds) to be useful in command-line workflows

2. **Memory Usage**:
   - Efficient memory usage (<200MB) to run on standard developer machines

3. **Concurrency**:
   - Support multiple simultaneous requests
   - Queue requests if needed to avoid overwhelming API providers

## Technical Requirements

### Dependencies

1. **Required Dependencies**:
   - `@modelcontextprotocol/sdk`: For MCP server implementation
   - `ai`: Vercel AI SDK for model interactions
   - `@ai-sdk/openai`: OpenAI provider for Vercel AI SDK
   - `@ai-sdk/gemini`: Google provider for Vercel AI SDK
   - `zod`: For schema validation
   - `dotenv`: For environment variable loading

2. **Development Dependencies**:
   - TypeScript and related tooling
   - Testing framework
   - Linting and formatting tools

### Code Structure

1. **Modular Design**:
   - Separate providers, tools, and server setup
   - Clean separation of concerns

2. **Type Safety**:
   - Full TypeScript typing for all functions and interfaces
   - Export types for potential consumption by other packages

### Distribution

1. **Package Structure**:
   - Must be runnable via npx without installation
   - Must include compiled JavaScript for direct execution
   - Must include TypeScript declarations for typing support

2. **Binary Support**:
   - Include bin entry in package.json for direct execution

3. **NPM Configuration**:
   - Proper package.json with all required fields
   - Include README, LICENSE, and other standard files

## Documentation Requirements

### README

1. **Installation and Usage**:
   - Clear installation instructions
   - Usage examples with different MCP clients
   - Configuration options

2. **Features and Capabilities**:
   - Detailed description of available tools
   - Explanation of input and output schemas
   - Examples of inputs and outputs

3. **Troubleshooting**:
   - Common issues and solutions
   - API key troubleshooting

### API Documentation

1. **Tool Documentation**:
   - Purpose and description of each tool
   - Complete schema documentation
   - Example requests and responses

2. **Integration Documentation**:
   - How to integrate with Claude Code
   - How to integrate with Claude Desktop
   - How to integrate with other MCP clients (Cursor, Windsurf)

## Example Uses

The documentation should include the following example uses:

1. **Basic Code Review**:
   ```bash
   # Pipe code to the server for review
   cat myfile.js | OPENAI_API_KEY=<key> npx -y claude-code-review-mcp review --model gpt-4o-mini
   ```

2. **Claude Code Integration**:
   ```bash
   # Add the MCP server to Claude Code
   claude mcp add code-review -- npx -y claude-code-review-mcp
   ```

3. **Custom Slash Command in Claude Code**:
   ```bash
   # Create a custom slash command
   echo "I'll review your code using alternative LLM models. Model to use: $ARGUMENTS" > .claude/commands/review-with.md
   ```

4. **Model Selection**:
   ```bash
   # Use Google's Gemini model
   GOOGLE_API_KEY=<key> npx -y claude-code-review-mcp review --model gemini-1.5-pro
   ```

5. **Project Context**:
   ```bash
   # Include project context in the review
   OPENAI_API_KEY=<key> npx -y claude-code-review-mcp review --model gpt-4o --context-dir ./src
   ```

## Security Requirements

1. **API Key Handling**:
   - Never log or expose API keys
   - Only use API keys for their intended providers

2. **Code Privacy**:
   - Do not send or store reviewed code outside of necessary API calls
   - Minimize logging of code contents

3. **Dependency Security**:
   - Maintain minimal dependencies to reduce security surface
   - Regular updates for security patches

## Compatibility Requirements

1. **Node.js Versions**:
   - Support Node.js 18.x and later

2. **Platform Support**:
   - Work on Linux, macOS, and Windows (via WSL if necessary)

3. **MCP Client Compatibility**:
   - Verified compatibility with Claude Code, Claude Desktop, Cursor, and Windsurf
   - Follow MCP protocol spec strictly for maximum compatibility

This requirements document provides a comprehensive blueprint for implementing the `claude-code-review-mcp` server. By following these specifications, developers can create a standardized, reliable tool that integrates well with various MCP clients and provides valuable code review functionality using popular LLM models.