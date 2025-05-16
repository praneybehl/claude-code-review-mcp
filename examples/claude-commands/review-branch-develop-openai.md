Perform a code review of changes between the develop branch and the current HEAD using OpenAI's **O4-mini**.

Use the 'perform_code_review' tool (from the 'code-reviewer' MCP server) with the following parameters:
target: "branch_diff"
diffBase: "develop"
llmProvider: "openai"
modelName: "o4-mini"
taskDescription: "The task I am currently working on in this codebase"
reviewFocus: "General code quality, security best practices, and performance considerations"
projectContext: "This is the current project I'm working on. Look for the CLAUDE.md file in the repository root if it exists for additional project context."
