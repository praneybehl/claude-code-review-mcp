# claude-code-review-mcp

An MCP (Model Context Protocol) server that provides code review functionality using OpenAI, Google, and Anthropic models. It serves as a "second opinion" tool for code review that can be used with any MCP client, including Claude Code, Claude Desktop, Cursor, and Windsurf.

## Features

- **Multi-Provider Support**: Leverages OpenAI, Google's Gemini, and Anthropic's Claude models for code reviews
- **Two Review Types**: Choose between structured review (with categorized feedback) or freeform narrative review
- **Context-Aware**: Include project structure, related files, commit messages, and dependencies for more relevant reviews
- **Intelligent Code Processing**: Automatically detects programming languages, handles large files, and formats output appropriately
- **Robust Error Handling**: Includes retry logic for API failures and graceful error recovery
- **MCP Compatible**: Works with any MCP client (Claude Code, Claude Desktop, Cursor, Windsurf)
- **Easy Setup**: Simple configuration via environment variables

## Installation

### Global Installation

```bash
npm install -g claude-code-review-mcp
```

### Usage with npx (no installation)

```bash
# Set environment variables separately
export OPENAI_API_KEY=<key>
npx -y claude-code-review-mcp

# Or use inline environment setting
OPENAI_API_KEY=<key> npx -y claude-code-review-mcp

# Or with Google API key
GOOGLE_API_KEY=<key> npx -y claude-code-review-mcp

# Or with Anthropic API key
ANTHROPIC_API_KEY=<key> npx -y claude-code-review-mcp

# Or use multiple API keys for more model options
OPENAI_API_KEY=<key> GOOGLE_API_KEY=<key> ANTHROPIC_API_KEY=<key> npx -y claude-code-review-mcp
```

## Configuration

The server requires at least one of the following API keys:

- `OPENAI_API_KEY`: Your OpenAI API key
- `GOOGLE_API_KEY`: Your Google Gemini API key
- `ANTHROPIC_API_KEY`: Your Anthropic API key

Optional configuration:

- `PORT`: Server port (default: dynamic - an available port will be chosen)
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

### Anthropic Models (requires ANTHROPIC_API_KEY)

- `claude-3-opus-20240229` - Anthropic Claude 3 Opus
- `claude-3-sonnet-20240229` - Anthropic Claude 3 Sonnet
- `claude-3-haiku-20240307` - Anthropic Claude 3 Haiku

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
# Use environment variables properly (recommended approach)
claude mcp add code-review -s user -e OPENAI_API_KEY=<key> -e GOOGLE_API_KEY=<key> -e ANTHROPIC_API_KEY=<key> -- npx -y claude-code-review-mcp

# Alternative: Export the variables before adding the MCP
export OPENAI_API_KEY=<key>
export GOOGLE_API_KEY=<key>
export ANTHROPIC_API_KEY=<key>
claude mcp add code-review -s user -- npx -y claude-code-review-mcp
```

You can also create a custom slash command by creating a file at `.claude/commands/review-with.md`:

```markdown
I'll review your code using alternative LLM models. Model to use: $ARGUMENTS
```

<details>
<summary><b>Detailed Custom Slash Commands for Claude Code</b></summary>

Claude Code supports custom slash commands that you can create to easily interact with the MCP server. Create these commands in the `.claude/commands/` directory within your project to enable powerful code review workflows.

### Basic Setup

First, create the commands directory if it doesn't exist:

```bash
mkdir -p .claude/commands
```

### Model Listing Command

Create a command to list available models:

```bash
# Create the list-review-models.md file
cat > .claude/commands/list-review-models.md << 'EOF'
I'll check which alternative code review models are available through our MCP server.

First, I'll use the MCP server to list all available models for code review.
After that, I'll present the models in a clear table format with:
- Model ID (what you'll use when requesting a review)
- Provider (OpenAI or Google)
- Description (size and capabilities)
- Speed (relative performance)

This will help you choose the right model for your code review needs.
EOF
```

### Basic Code Review Command

Create a simple review command that accepts a model name:

```bash
# Create the review-with.md file
cat > .claude/commands/review-with.md << 'EOF'
I'll review the code I've just worked on using an alternative LLM model to provide a second opinion.

First, I'll identify the code changes or file you want reviewed. If you don't specify a file, I'll look at recent changes.

Then, I'll send this code to be reviewed by the specified model through our MCP server.

Available models (run /project:list-review-models to see all options):
- OpenAI models (if configured): "gpt-4.1", "o4-mini", "o3-mini"
- Google models (if configured): "gemini-2.5-pro-preview-05-06", "gemini-2.5-flash-preview-04-17"

Model to use (leave blank for default): $ARGUMENTS
EOF
```

### Structured Review Command

Create a command specifically for structured reviews:

```bash
# Create the structured-review.md file
cat > .claude/commands/structured-review.md << 'EOF'
I'll perform a structured code review using an alternative LLM model.

This review will be organized into clear sections:
1. Overall summary
2. Code quality assessment (strengths and weaknesses)
3. Potential bugs with severity ratings (Low/Medium/High)
4. Specific improvement suggestions
5. Security considerations (if applicable)

If you don't specify a model, I'll use the default available model.

Model to use (optional): $ARGUMENTS
EOF
```

### Freeform Review Command

Create a command for narrative-style reviews:

```bash
# Create the freeform-review.md file
cat > .claude/commands/freeform-review.md << 'EOF'
I'll provide a conversational, narrative-style code review using an alternative LLM model.

This will be a more holistic assessment of your code with flowing paragraphs rather than structured categories. This style works well for:
- General impressions
- High-level feedback
- More nuanced commentary on code style and approach

If you don't specify a model, I'll use the default available model.

Model to use (optional): $ARGUMENTS
EOF
```

### Review Specific File Command

Create a command to review a specific file:

```bash
# Create the review-file.md file
cat > .claude/commands/review-file.md << 'EOF'
I'll review a specific file using an alternative LLM model.

Please provide the file path to review and optionally the model to use.
Format: [file_path] [model_name]

For example:
- "src/utils.js gemini-2.5-pro-preview-05-06" - Reviews utils.js with Gemini Pro
- "lib/auth.ts" - Reviews auth.ts with the default model

Input: $ARGUMENTS
EOF
```

### Focus-Specific Review Commands

Create commands for specialized reviews:

```bash
# Create security review command
cat > .claude/commands/security-review.md << 'EOF'
I'll perform a security-focused code review using an alternative LLM model.

This review will specifically examine:
- Potential security vulnerabilities
- Input validation issues
- Authentication/authorization flaws
- Data protection concerns
- Injection vulnerabilities
- Secure coding best practices

If you don't specify a model, I'll use a model recommended for security analysis.

Model to use (optional): $ARGUMENTS
EOF
```

```bash
# Create performance review command
cat > .claude/commands/performance-review.md << 'EOF'
I'll perform a performance-focused code review using an alternative LLM model.

This review will specifically examine:
- Algorithm efficiency
- Memory usage
- Unnecessary computations
- Loop optimizations
- Data structure choices
- Caching opportunities
- Async/parallel processing considerations

If you don't specify a model, I'll use a model that's good at performance analysis.

Model to use (optional): $ARGUMENTS
EOF
```

### Comprehensive Project Review Command

Create a command for reviewing code with full project context:

```bash
# Create the project-review.md file
cat > .claude/commands/project-review.md << 'EOF'
I'll perform a comprehensive code review with full project context using an alternative LLM model.

This review will:
1. Analyze the code structure and organization
2. Consider related files and dependencies
3. Evaluate consistency with project patterns
4. Assess integration with existing components
5. Check alignment with project architecture

I'll gather project context, including directory structure and related files, to ensure a thorough, context-aware review.

Format: [file_to_review] [model_name]
Example: "src/components/Button.jsx gemini-2.5-pro-preview-05-06"

Input: $ARGUMENTS
EOF
```

### Before and After Review Command

Create a command to compare code changes:

```bash
# Create the diff-review.md file
cat > .claude/commands/diff-review.md << 'EOF'
I'll review the changes you've made to a file using an alternative LLM model.

This will:
1. Identify what was changed between versions
2. Evaluate if the changes address the intended purpose
3. Check for any new issues introduced
4. Suggest potential improvements to the changes

I'll need to know which file to examine. If you've been working on a file with Claude Code, I'll automatically find the changes.

Model to use (optional): $ARGUMENTS
EOF
```

### Using Custom Slash Commands

Once you've created these commands, you can use them in Claude Code by typing `/project:` followed by the command name. For example:

```
/project:list-review-models
/project:review-with gemini-2.5-pro-preview-05-06
/project:structured-review o4-mini
/project:security-review
/project:review-file src/utils.js gemini-2.5-flash-preview-04-17
```

### Tips for Custom Commands

- **Command Discovery**: Type `/project:` in Claude Code to see a list of available commands
- **Default Models**: If you don't specify a model, the command will use the default model (typically o4-mini if available)
- **Multiple Reviews**: You can get multiple perspectives by running reviews with different models
- **Project Context**: For the most relevant reviews, use commands that include project context
- **Specialized Focus**: Use the focus-specific commands when you have particular concerns about security, performance, etc.

### Example Workflow

A typical workflow might look like:

1. Work on code with Claude Code
2. Run `/project:list-review-models` to see available options
3. Run `/project:structured-review gemini-2.5-pro-preview-05-06` to get a structured review from Google's model
4. Compare with Claude's suggestions
5. Make improvements based on both perspectives
6. Run `/project:diff-review` to review the changes

These custom commands enable smooth integration between Claude Code and the claude-code-review-mcp server, providing valuable "second opinions" for your code.

</details>

## Example Usage

### Starting the MCP Server

```bash
# Start with OpenAI API key (using exports, recommended)
export OPENAI_API_KEY=<key>
npx -y claude-code-review-mcp

# Or with inline environment variables
OPENAI_API_KEY=<key> npx -y claude-code-review-mcp

# Start with Google Gemini API key
export GOOGLE_API_KEY=<key>
npx -y claude-code-review-mcp

# Start with Anthropic Claude API key
export ANTHROPIC_API_KEY=<key>
npx -y claude-code-review-mcp

# Use multiple API keys for more model options
export OPENAI_API_KEY=<key>
export GOOGLE_API_KEY=<key>
export ANTHROPIC_API_KEY=<key>
npx -y claude-code-review-mcp

# Use custom port and host
export OPENAI_API_KEY=<key>
export PORT=8080 
export HOST=0.0.0.0
npx -y claude-code-review-mcp
```

### Using with MCP Clients

Once the server is running, you can connect to it from any MCP client like Claude Code, Claude Desktop, Cursor, or Windsurf using the server's URL. The server will display the actual URL and port in its startup logs (using a dynamically assigned port to avoid conflicts).

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
claude mcp add code-review -s user npx -y claude-code-review-mcp
```

2. Use in Claude Code:

```
/code-review:reviewCodeStructured --model o4-mini
```

### Claude Desktop

In Claude Desktop settings, configure the MCP as follows:

```json
"claude-code-review-mcp": {
  "command": "npx",
  "args": ["-y", "claude-code-review-mcp"],
  "env": {
    "OPENAI_API_KEY": "your-openai-key",
    "GOOGLE_API_KEY": "your-google-key",
    "ANTHROPIC_API_KEY": "your-anthropic-key"
  }
}
```

### MCP Inspector

For using with the [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector), use the specialized compatibility wrapper which fixes JSON-RPC formatting issues:

```bash
# Start the MCP server with Inspector compatibility
npx -y claude-code-review-mcp-inspector

# Or with environment variables
OPENAI_API_KEY=<key> npx -y claude-code-review-mcp-inspector
```

When integrating with Claude Code, use:

```bash
claude mcp add code-review -s user npx -y claude-code-review-mcp-inspector
```

The wrapper specifically addresses JSON parsing issues that can occur with the MCP Inspector by providing an additional compatibility layer.

The server uses advanced JSON output sanitization for full compatibility with all MCP clients, including Claude Desktop and MCP Inspector.

### Cursor and Windsurf

Follow the specific MCP configuration guidelines for your client, using the same command and environment variables.

## Troubleshooting

### API Key Issues

- **"Model X is not available"**: Ensure you've provided the appropriate API key for the model.
- **No API keys provided**: You must provide at least one of OPENAI_API_KEY, GOOGLE_API_KEY, or ANTHROPIC_API_KEY.
- **Suggested model**: The server will suggest alternative models if your requested model is not available.

### JSON Parsing Errors with MCP Inspector

If you encounter JSON parsing errors when connecting to the MCP server through MCP Inspector (common error: "SyntaxError: Unexpected token at position 5"), use the specialized Inspector compatibility wrapper:

```bash
# Instead of standard MCP server
npx -y claude-code-review-mcp-inspector
```

This wrapper specifically fixes JSON formatting issues that can occur in the communication between the MCP Inspector and our server.

### Rate Limiting and API Errors

- If you encounter rate limits or API errors, the error message will indicate the issue.
- Consider using a different model if one provider is experiencing issues.

## Security Considerations

- API keys are never logged or exposed
- Code contents are minimally logged for privacy
- Dependencies are kept minimal to reduce security surface
- Request handling includes input validation and sanitization
- Error messages are designed to avoid leaking sensitive information

## Compatibility

- Requires Node.js 18.0.0 or later
- Works on Linux, macOS, and Windows (via WSL if necessary)
- Compatible with all MCP clients (Claude Code, Claude Desktop, Cursor, Windsurf)
- Graceful handling of large code files and project contexts
- Automatic retry mechanism for transient API failures

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