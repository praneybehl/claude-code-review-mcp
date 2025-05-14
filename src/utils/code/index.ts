/**
 * Code processing utilities for handling code formatting, chunking, and analysis
 */

import * as logger from '../logger.js';
import type { CodeReviewInput, RelatedFile } from '../../schemas/index.js';

// Maximum size for code to be sent to an LLM in a single request
// This is conservative to ensure it fits within most LLM context limits
const MAX_CODE_SIZE = 60000;

// Maximum size for related files
const MAX_RELATED_FILE_SIZE = 20000;

/**
 * Interface for code statistics
 */
interface CodeStats {
  totalChars: number;
  totalLines: number;
  commentLines: number;
  blankLines: number;
  codeLines: number;
  language?: string;
  fileExtension?: string;
}

/**
 * Get the programming language from a filename or explicitly provided language
 * 
 * @param filename The filename to infer language from
 * @param explicitLanguage Optional explicitly provided language
 * @returns The inferred or provided language
 */
export function getLanguage(filename?: string, explicitLanguage?: string): string | undefined {
  // Return explicitly provided language if available
  if (explicitLanguage) {
    return explicitLanguage;
  }
  
  // Try to infer from filename
  if (!filename) {
    return undefined;
  }
  
  const extension = filename.split('.').pop()?.toLowerCase();
  
  if (!extension) {
    return undefined;
  }
  
  // Map common file extensions to languages
  const extensionMap: Record<string, string> = {
    // JavaScript
    'js': 'JavaScript',
    'jsx': 'JavaScript (React)',
    'mjs': 'JavaScript (Module)',
    
    // TypeScript
    'ts': 'TypeScript',
    'tsx': 'TypeScript (React)',
    
    // Web
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'sass': 'Sass',
    'less': 'LESS',
    
    // Python
    'py': 'Python',
    'pyi': 'Python',
    'pyw': 'Python',
    
    // Ruby
    'rb': 'Ruby',
    'erb': 'Ruby (ERB)',
    
    // Java
    'java': 'Java',
    
    // PHP
    'php': 'PHP',
    
    // C/C++
    'c': 'C',
    'h': 'C Header',
    'cpp': 'C++',
    'hpp': 'C++ Header',
    
    // C#
    'cs': 'C#',
    
    // Go
    'go': 'Go',
    
    // Rust
    'rs': 'Rust',
    
    // Swift
    'swift': 'Swift',
    
    // Kotlin
    'kt': 'Kotlin',
    
    // Shell
    'sh': 'Shell',
    'bash': 'Bash',
    
    // Configuration
    'json': 'JSON',
    'yaml': 'YAML',
    'yml': 'YAML',
    'toml': 'TOML',
    'xml': 'XML',
    'ini': 'INI',
    'env': 'Environment Variables',
    
    // Markdown/Documentation
    'md': 'Markdown',
    'mdx': 'MDX',
    'rst': 'reStructuredText',
    
    // SQL
    'sql': 'SQL',
    
    // Other
    'dart': 'Dart',
    'groovy': 'Groovy',
    'scala': 'Scala',
    'clj': 'Clojure',
    'edn': 'EDN (Clojure)',
    'hs': 'Haskell',
    'lua': 'Lua',
    'pl': 'Perl',
    'r': 'R',
  };
  
  return extensionMap[extension] || undefined;
}

/**
 * Analyze code to gather statistics and language information
 * 
 * @param code The code to analyze
 * @param filename Optional filename to help infer language
 * @param language Optional explicitly provided language
 * @returns Statistics about the code
 */
export function analyzeCode(code: string, filename?: string, language?: string): CodeStats {
  const lines = code.split('\n');
  let commentLines = 0;
  let blankLines = 0;
  
  // Detect language if not provided
  const inferredLanguage = getLanguage(filename, language);
  const fileExtension = filename?.split('.').pop()?.toLowerCase();
  
  // Count blank and comment lines (simple implementation)
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine === '') {
      blankLines++;
      continue;
    }
    
    // Simple comment detection - not perfect but works for most languages
    if (
      trimmedLine.startsWith('//') || 
      trimmedLine.startsWith('#') || 
      trimmedLine.startsWith('/*') || 
      trimmedLine.startsWith('*') || 
      trimmedLine.startsWith('"""') || 
      trimmedLine.startsWith("'''") || 
      trimmedLine.startsWith('<!--')
    ) {
      commentLines++;
    }
  }
  
  return {
    totalChars: code.length,
    totalLines: lines.length,
    commentLines,
    blankLines,
    codeLines: lines.length - commentLines - blankLines,
    language: inferredLanguage,
    fileExtension
  };
}

/**
 * Prepare input for code review by ensuring it fits within LLM context limits
 * and handling related files appropriately
 * 
 * @param input The original code review input
 * @returns A processed input suitable for sending to LLMs
 */
export function prepareCodeReviewInput(input: CodeReviewInput): CodeReviewInput {
  try {
    const stats = analyzeCode(input.code, input.filename, input.language);
    
    // Add inferred language if not provided
    if (!input.language && stats.language) {
      input.language = stats.language;
      logger.debug(`Inferred language: ${stats.language} from filename: ${input.filename}`);
    }
    
    // Ensure code size is within reasonable limits
    let processedCode = input.code;
    if (input.code.length > MAX_CODE_SIZE) {
      logger.warn(`Code exceeds maximum size (${input.code.length} > ${MAX_CODE_SIZE}), truncating`);
      processedCode = input.code.substring(0, MAX_CODE_SIZE) + 
        `\n\n/* Code truncated (${input.code.length - MAX_CODE_SIZE} characters removed) */`;
    }
    
    // Process related files if present
    let relatedFiles: RelatedFile[] = [];
    if (input.projectContext?.relatedFiles?.length) {
      relatedFiles = input.projectContext.relatedFiles.map(file => {
        // Infer language for related files if not provided
        let fileLanguage = file.language;
        if (!fileLanguage) {
          fileLanguage = getLanguage(file.name);
        }
        
        // Ensure related file size is within reasonable limits
        let content = file.content;
        if (content.length > MAX_RELATED_FILE_SIZE) {
          content = content.substring(0, MAX_RELATED_FILE_SIZE) + 
            `\n\n/* File truncated (${content.length - MAX_RELATED_FILE_SIZE} characters removed) */`;
        }
        
        return {
          name: file.name,
          language: fileLanguage,
          content
        };
      });
    }
    
    // Prepare cleaned input
    const processedInput: CodeReviewInput = {
      ...input,
      code: processedCode,
      language: input.language || stats.language,
    };
    
    // Update related files if they were processed
    if (input.projectContext?.relatedFiles) {
      processedInput.projectContext = {
        ...input.projectContext,
        relatedFiles,
      };
    }
    
    return processedInput;
  } catch (error) {
    logger.error('Error preparing code review input:', error);
    return input; // Return original input if something goes wrong
  }
}

/**
 * Format project structure for inclusion in prompts
 * 
 * @param structure Raw project structure string
 * @returns Formatted project structure
 */
export function formatProjectStructure(structure: string): string {
  // Simple implementation that ensures consistent formatting
  const lines = structure.split('\n');
  
  // Limit depth to prevent prompt bloat
  const MAX_DEPTH = 5;
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    const depth = line.length - trimmed.length; // Rough estimation based on indentation
    return depth <= MAX_DEPTH;
  });
  
  return filteredLines.join('\n');
}

/**
 * Extract relevant context from code and related files
 * Useful when there's too much code to fit in a single LLM request
 * 
 * @param input The code review input
 * @param targetCharLimit Target character limit for the output
 * @returns A summary of the code with the most relevant parts
 */
export function extractCodeContext(input: CodeReviewInput, targetCharLimit: number = 10000): string {
  let context = '';
  
  // Add file information
  if (input.filename) {
    context += `Filename: ${input.filename}\n`;
  }
  
  if (input.language) {
    context += `Language: ${input.language}\n`;
  }
  
  // Add code statistics
  const stats = analyzeCode(input.code, input.filename, input.language);
  context += `\nCode Statistics:\n`;
  context += `- Total lines: ${stats.totalLines}\n`;
  context += `- Code lines: ${stats.codeLines}\n`;
  context += `- Comment lines: ${stats.commentLines}\n`;
  context += `- Blank lines: ${stats.blankLines}\n\n`;
  
  // Extract meaningful sections of the code
  
  // 1. Extract imports/includes/requires
  context += `Imports/Dependencies:\n`;
  const importLines = input.code.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed.startsWith('import ') || 
           trimmed.startsWith('from ') || 
           trimmed.startsWith('#include') ||
           trimmed.startsWith('require(') ||
           trimmed.startsWith('use ');
  });
  
  context += importLines.join('\n') + '\n\n';
  
  // 2. Extract function/class/method signatures
  context += `Functions and Classes:\n`;
  const signatureLines = input.code.split('\n').filter(line => {
    const trimmed = line.trim();
    return (trimmed.startsWith('function ') || 
            trimmed.startsWith('class ') ||
            trimmed.startsWith('def ') ||
            trimmed.match(/\s*\w+\s*\([^)]*\)\s*\{/) ||
            trimmed.match(/\s*\w+\s*=\s*function\s*\(/)) &&
           !trimmed.includes(';');
  });
  
  context += signatureLines.join('\n') + '\n\n';
  
  // 3. Add start of the main code
  const mainCodeStart = input.code.substring(0, 1000) + 
    (input.code.length > 1000 ? '...' : '');
  context += `Start of Main Code:\n${mainCodeStart}\n\n`;
  
  // 4. Add related file summaries if present
  if (input.projectContext?.relatedFiles?.length) {
    context += `Related Files:\n`;
    for (const file of input.projectContext.relatedFiles) {
      context += `- ${file.name}${file.language ? ` (${file.language})` : ''}: `;
      
      // Add first 200 chars of each related file
      const preview = file.content.substring(0, 200) + 
        (file.content.length > 200 ? '...' : '');
      
      context += `${preview}\n`;
    }
  }
  
  // Ensure we're within the target limit
  if (context.length > targetCharLimit) {
    context = context.substring(0, targetCharLimit) + 
      `\n\n/* Context truncated due to size limit */`;
  }
  
  return context;
}