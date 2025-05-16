Perform a code review on all **uncommitted changes** (both staged and unstaged) using Google's **Gemini 2.5 Pro**.

Use the 'perform_code_review' tool (from the 'code-reviewer' MCP server) with the following parameters:
target: "HEAD"
llmProvider: "google"
modelName: "gemini-2.5-pro-preview-05-06"
taskDescription: "The task I am currently working on in this codebase"
reviewFocus: "General code quality, security best practices, and performance considerations"
projectContext: "This is the current project I'm working on. Look for the CLAUDE.md file in the repository root if it exists for additional project context."
