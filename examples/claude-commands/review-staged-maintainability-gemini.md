Perform a maintainability-focused code review on the currently **staged** changes using Google's **Gemini 2.5 Flash**.

Use the 'perform_code_review' tool (from the 'code-reviewer' MCP server) with the following parameters:
target: "staged"
llmProvider: "google"
modelName: "gemini-2.5-flash-preview-04-17"
taskDescription: "The task I am currently working on in this codebase"
reviewFocus: "Code readability, maintainability, documentation, naming conventions, SOLID principles, design patterns, abstraction, and testability"
projectContext: "This is the current project I'm working on. Look for the CLAUDE.md file in the repository root if it exists for additional project context."
