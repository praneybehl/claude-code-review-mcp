Perform a code review of changes between a specified branch and the current HEAD using Google's **Gemini 2.0 Flash**.

Use the 'perform_code_review' tool (from the 'code-reviewer' MCP server) with the following parameters:
target: "branch_diff"
diffBase: "$ARGUMENTS_BASE_BRANCH"
llmProvider: "google"
modelName: "gemini-2.0-flash"
taskDescription: "The task I am currently working on in this codebase"
reviewFocus: "General code quality, security best practices, and performance considerations"
projectContext: "This is the current project I'm working on. Look for the CLAUDE.md file in the repository root if it exists for additional project context."
