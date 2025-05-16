# Review All Uncommitted Changes

Perform a code review on all uncommitted changes (both staged and unstaged) against the last commit.

## Step 1

Use the perform_code_review tool from the code-reviewer MCP server with the following parameters:
```
{
  "target": "HEAD",
  "llmProvider": "openai",
  "modelName": "o3",
  "taskDescription": "The task I am currently working on in this codebase",
  "reviewFocus": "General code quality, security best practices, and performance considerations",
  "projectContext": "This project is being developed in Windsurf. Please review the code carefully for any issues."
}
```

<!-- 
Note: 
1. Consider updating the model name to the latest available model from OpenAI
2. Customize the taskDescription with specific context for better review results
-->

