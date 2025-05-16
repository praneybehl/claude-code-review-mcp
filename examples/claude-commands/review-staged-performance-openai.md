Perform a performance-focused code review on the currently **staged** changes using OpenAI's **O3**.

Use the 'perform_code_review' tool (from the 'code-reviewer' MCP server) with the following parameters:
target: "staged"
llmProvider: "openai"
modelName: "o3"
taskDescription: "The task I am currently working on in this codebase"
reviewFocus: "Performance optimizations, computational efficiency, memory usage, time complexity, algorithmic improvements, bottlenecks, lazy loading, and caching opportunities"
projectContext: "This is the current project I'm working on. Look for the CLAUDE.md file in the repository root if it exists for additional project context."
