Perform a code review on the currently **staged** changes using OpenAI's **GPT-4.1**.

Use the 'perform_code_review' tool (from the 'code-reviewer' MCP server) with the following parameters:
target: "staged"
llmProvider: "openai"
modelName: "gpt-4.1"
taskDescription: "The task I am currently working on in this codebase"
reviewFocus: "General code quality, security best practices, and performance considerations"
projectContext: "This is the current project I'm working on. Look for the CLAUDE.md file in the repository root if it exists for additional project context."
