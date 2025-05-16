# Branch Diff Review

Perform a code review comparing the current HEAD with a specified base branch.

## Step 1

Ask the user which branch to compare against:
"Which branch would you like to use as the base for comparison? (e.g., main, develop)"

## Step 2

Use the perform_code_review tool from the code-reviewer MCP server with the following parameters:
```
{
  "target": "branch_diff",
  "diffBase": "${user_response}",
  "llmProvider": "google",
  "modelName": "gemini-2.5-pro-preview-05-06",
  "taskDescription": "The task I am currently working on in this codebase",
  "reviewFocus": "General code quality, security best practices, and performance considerations",
  "projectContext": "This project is being developed in Windsurf. Please review the code changes between branches carefully for any issues."
}
```

<!-- 
Notes:
1. Consider updating the model name to the latest available model from Google
2. Customize the taskDescription with specific context for better review results
3. IMPORTANT: The MCP server sanitizes the diffBase parameter to prevent command injection attacks,
   but you should still avoid using branch names containing special characters
-->

