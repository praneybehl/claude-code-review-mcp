# Security Review

Perform a security-focused code review on the currently staged changes in the repository.

## Step 1

Use the perform_code_review tool from the code-reviewer MCP server with the following parameters:
```
{
  "target": "staged",
  "llmProvider": "anthropic",
  "modelName": "claude-3-5-sonnet-20241022",
  "taskDescription": "The task I am currently working on in this codebase",
  "reviewFocus": "Security vulnerabilities, data validation, authentication, authorization, input sanitization, sensitive data handling, and adherence to OWASP standards",
  "projectContext": "This project is being developed in Windsurf. Please review the code carefully for any security issues."
}
```

<!-- 
Note: 
1. Consider updating the model name to the latest available model from Anthropic
2. Customize the taskDescription with specific context for better security review results
3. You can further customize the reviewFocus to target specific security concerns for your project
-->

