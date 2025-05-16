Perform a code review of changes between a specified branch and the current HEAD using Google's **Gemini 2.5 Flash**.

Use the 'perform_code_review' tool (from the 'code-reviewer' MCP server) with the following parameters:
target: "branch_diff"
diffBase: "$ARGUMENTS_BASE_BRANCH"
llmProvider: "google"
modelName: "gemini-2.5-flash-preview-04-17"
taskDescription: "The task I am currently working on in this codebase"
reviewFocus: "General code quality, security best practices, and performance considerations"
projectContext: "This is the current project I'm working on. Look for the CLAUDE.md file in the repository root if it exists for additional project context."

# Usage: 
# Invoke this command with the base branch name as an argument:
# claude > /project:review-branch-custom-gemini main
# This will compare your current HEAD against the 'main' branch.
