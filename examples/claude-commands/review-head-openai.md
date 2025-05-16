Perform a code review on all **uncommitted changes** (both staged and unstaged) using OpenAI's **O3**.

Use the 'perform_code_review' tool (from the 'code-reviewer' MCP server) with the following parameters:
target: "HEAD"
llmProvider: "openai"
modelName: "o3"
taskDescription: "The task I am currently working on in this codebase"
reviewFocus: "General code quality, security best practices, and performance considerations"
projectContext: "This is the current project I'm working on. Look for the CLAUDE.md file in the repository root if it exists for additional project context."
