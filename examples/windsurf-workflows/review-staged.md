# Review Staged Changes

Perform a code review on the currently staged changes in the repository.

## Step 1

Use the perform_code_review tool from the code-reviewer MCP server with the following parameters:
```
{
  "target": "staged",
  "llmProvider": "anthropic",
  "modelName": "claude-3-7-sonnet-20250219",
  "taskDescription": "The task I am currently working on in this codebase",
  "reviewFocus": "General code quality, security best practices, and performance considerations",
  "projectContext": "This project is being developed in Windsurf. Please review the code carefully for any issues."
}
```

<!-- 
Note: 
1. Consider updating the model name to the latest available model from Anthropic
2. Customize the taskDescription with specific context for better review results
-->

