# claude-code-review-mcp

An MCP (Model Context Protocol) server that provides code review functionality using OpenAI and Google models. It serves as a "second opinion" tool for code review that can be used with any MCP client, including Claude Code, Claude Desktop, Cursor, and Windsurf.

## Features

- **Multiple LLM Support**: Leverages both OpenAI and Google's Gemini models for code reviews
- **Two Review Types**: Choose between structured review (with categorized feedback) or freeform narrative review
- **Context-Aware**: Include project structure, related files, commit messages, and dependencies for more relevant reviews
- **MCP Compatible**: Works with any MCP client (Claude Code, Claude Desktop, Cursor, Windsurf)
- **Easy Setup**: Simple configuration via environment variables

## Installation

### Global Installation

```bash
npm install -g claude-code-review-mcp
```

### Usage with npx (no installation)

```bash
OPENAI_API_KEY=<key> npx -y claude-code-review-mcp
# or
GOOGLE_API_KEY=<key> npx -y claude-code-review-mcp
# or use both
OPENAI_API_KEY=<key> GOOGLE_API_KEY=<key> npx -y claude-code-review-mcp
```

## Configuration

The server requires at least one of the following API keys:

- `OPENAI_API_KEY`: Your OpenAI API key
- `GOOGLE_API_KEY`: Your Google Gemini API key

Optional configuration:

- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: 127.0.0.1)
- `LOG_LEVEL`: Log level (0=DEBUG, 1=INFO, 2=WARN, 3=ERROR; default: 1)

## Available Models

### OpenAI Models (requires OPENAI_API_KEY)

- `gpt-4.1` - OpenAI GPT-4.1
- `o4-mini` - OpenAI O4 Mini
- `o3-mini` - OpenAI O3 Mini

### Google Models (requires GOOGLE_API_KEY)

- `gemini-2.5-pro-preview-05-06` - Google Gemini 2.5 Pro
- `gemini-2.5-flash-preview-04-17` - Google Gemini 2.5 Flash

## Available Tools

The MCP server provides three tools:

### 1. reviewCodeStructured

Provides a detailed, structured code review with the following sections:

- Overall summary
- Code quality (strengths and weaknesses)
- Bugs (with severity and suggested fixes)
- Improvement suggestions
- Security issues (if any)

### 2. reviewCodeFreeform

Provides a narrative code review in free-form text format, suitable for general impressions and conversational feedback.

### 3. listModels

Lists all available models based on provided API keys, including model IDs and human-readable names.

## Integration with Claude Code

To add this MCP server to Claude Code:

```bash
claude mcp add code-review -- npx -y claude-code-review-mcp
```

You can also create a custom slash command by creating a file at `.claude/commands/review-with.md`:

```markdown
I'll review your code using alternative LLM models. Model to use: $ARGUMENTS
```

## Example Usage

### Basic Code Review

```bash
# Pipe code to the server for review
cat myfile.js | OPENAI_API_KEY=<key> npx -y claude-code-review-mcp review --model o4-mini
```

### Using Google's Gemini Model

```bash
GOOGLE_API_KEY=<key> npx -y claude-code-review-mcp review --model gemini-2.5-pro-preview-05-06
```

### Including Project Context

```bash
OPENAI_API_KEY=<key> npx -y claude-code-review-mcp review --model o4-mini --context-dir ./src
```

## Input Schema

All review tools accept the following input:

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

## Output Schema

### Structured Review Output

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

### Freeform Review Output

```typescript
{
  reviewText?: string;  // Present on success
  modelUsed: string;  // Human-readable model name
  error?: string;  // Present on error
  availableModels?: Record<string, string>;  // Present on error or listModels
}
```

### List Models Output

```typescript
{
  availableModels: Record<string, string>;  // Model ID to name mapping
  modelUsed: string;  // Always "None" for this tool
}
```

## MCP Client Integration

### Claude Code

1. Add the MCP server:

```bash
claude mcp add code-review -- npx -y claude-code-review-mcp
```

2. Use in Claude Code:

```
/code-review:reviewCodeStructured --model o4-mini
```

### Claude Desktop

In Claude Desktop, configure the MCP as follows:

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

### Cursor and Windsurf

Follow the specific MCP configuration guidelines for your client, using the same command and environment variables.

## Troubleshooting

### API Key Issues

- **"Model X is not available"**: Ensure you've provided the appropriate API key for the model.
- **No API keys provided**: You must provide at least one of OPENAI_API_KEY or GOOGLE_API_KEY.

### Rate Limiting and API Errors

- If you encounter rate limits or API errors, the error message will indicate the issue.
- Consider using a different model if one provider is experiencing issues.

## Security Considerations

- API keys are never logged or exposed
- Code contents are minimally logged for privacy
- Dependencies are kept minimal to reduce security surface

## Compatibility

- Requires Node.js 18.0.0 or later
- Works on Linux, macOS, and Windows (via WSL if necessary)
- Compatible with all MCP clients

## Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Build for production
npm run build

# Start in production mode
npm run start
```

## License

MIT

## Contributors

- Praney Behl (@praneybehl)