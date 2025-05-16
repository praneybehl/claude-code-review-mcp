Perform a code review of changes between the main branch and the current HEAD using Anthropic's **Claude 3.7 Sonnet**.

Use the 'perform_code_review' tool (from the 'code-reviewer' MCP server) with the following parameters:
target: "branch_diff"
diffBase: "main"
llmProvider: "anthropic"
modelName: "claude-3-7-sonnet-20250219"
taskDescription: "The task I am currently working on in this codebase"
reviewFocus: "General code quality, security best practices, and performance considerations"
projectContext: "This is the current project I'm working on. Look for the CLAUDE.md file in the repository root if it exists for additional project context."
