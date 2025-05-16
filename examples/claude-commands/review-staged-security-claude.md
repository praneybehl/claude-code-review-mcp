Perform a security-focused code review on the currently **staged** changes using Anthropic's **Claude 3.5 Sonnet**.

Use the 'perform_code_review' tool (from the 'code-reviewer' MCP server) with the following parameters:
target: "staged"
llmProvider: "anthropic"
modelName: "claude-3-5-sonnet-20241022"
taskDescription: "The task I am currently working on in this codebase"
reviewFocus: "Security vulnerabilities, data validation, authentication, authorization, input sanitization, sensitive data handling, and adherence to OWASP standards"
projectContext: "This is the current project I'm working on. Look for the CLAUDE.md file in the repository root if it exists for additional project context."
