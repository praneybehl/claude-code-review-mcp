/**
 * JSON safety utilities to ensure compatibility with MCP clients
 * 
 * These utilities fix common JSON formatting issues that can occur,
 * especially with the "position 5" error which happens when arrays are 
 * incorrectly formatted.
 */

import * as logger from './logger.js';

/**
 * Direct fix for the notorious "position 5" error
 * Inserts a comma at position 5 if needed
 * 
 * @param json JSON string that might have position 5 error
 * @returns Fixed JSON string if applicable
 */
export function fixPosition5Error(json: string): string {
  if (!json || json.length < 6) return json;
  
  // Check if this is a typical position 5 error
  try {
    JSON.parse(json);
    return json; // Already valid
  } catch (error) {
    // Look specifically for position 5 error
    if (error instanceof SyntaxError && 
        error.message.includes('position 5')) {
      
      logger.debug('Detected position 5 error, applying targeted fix');
      
      // Common pattern for position 5 error is often a missing comma in an array
      // Check if character at position 5 might need a comma before it
      const charAtPos4 = json.charAt(4);
      const charAtPos5 = json.charAt(5);
      
      // If position 4 is a quote or value end and position 5 is a quote or value start,
      // we likely need a comma between them
      if ((charAtPos4 === '"' || charAtPos4 === '\'') && 
          (charAtPos5 === '"' || charAtPos5 === '\'')) {
        const fixed = json.slice(0, 5) + ',' + json.slice(5);
        try {
          JSON.parse(fixed); // See if our fix works
          logger.info('Successfully fixed position 5 error with comma insertion');
          return fixed;
        } catch (fixError) {
          logger.debug('Simple position 5 fix didn\'t work, will try advanced repairs');
        }
      }
      
      // If we have '[' at position 4 and a space at position 5, remove the space
      if (charAtPos4 === '[' && /\s/.test(charAtPos5)) {
        let i = 5;
        // Skip all spaces
        while (i < json.length && /\s/.test(json.charAt(i))) {
          i++;
        }
        if (i < json.length) {
          const fixed = json.slice(0, 5) + json.slice(i);
          try {
            JSON.parse(fixed);
            logger.info('Successfully fixed position 5 error by removing whitespace');
            return fixed;
          } catch (fixError) {
            logger.debug('Whitespace removal at position 5 didn\'t work, will try advanced repairs');
          }
        }
      }
    }
  }
  
  return json; // Return original if no specific fix was applied
}

/**
 * Sanitize JSON to fix common issues including the notorious "position 5" error
 * 
 * @param json JSON string that might contain issues
 * @returns Sanitized JSON string
 */
export function sanitizeJson(json: string): string {
  if (!json) return json;
  
  try {
    // Try parsing first - if it's valid, return as is
    JSON.parse(json);
    return json;
  } catch (error) {
    // First try direct position 5 fix as it's the most common issue
    if (error instanceof SyntaxError && error.message.includes('position 5')) {
      const position5Fixed = fixPosition5Error(json);
      if (position5Fixed !== json) {
        try {
          JSON.parse(position5Fixed);
          return position5Fixed;
        } catch (e) {
          // Continue with other fixes
        }
      }
    }
    
    // If it's a syntax error, attempt to fix
    if (error instanceof SyntaxError) {
      logger.debug(`JSON syntax error detected: ${error.message}, attempting to fix`);
      const fixes: string[] = [];
      let modifiedJson = json;

      // Fix 1: Array with values missing commas e.g. [ "item1" "item2" ]
      // This directly addresses the position 5 error
      if (/\[\s*"[^"]+"\s+"[^"]+"/.test(modifiedJson)) {
        modifiedJson = modifiedJson.replace(/\[\s*"([^"]+)"\s+"([^"]+)"/g, '["$1","$2"');
        fixes.push('array-missing-commas-double-quotes');
      }
      
      if (/\[\s*'[^']+'\s+'[^']+'/.test(modifiedJson)) {
        modifiedJson = modifiedJson.replace(/\[\s*'([^']+)'\s+'([^']+)'/g, '["$1","$2"');
        fixes.push('array-missing-commas-single-quotes');
      }
      
      // Fix 2: Fix extra whitespace in arrays
      if (/\[\s+["']/.test(modifiedJson)) {
        modifiedJson = modifiedJson.replace(/\[\s+"/g, '["');
        modifiedJson = modifiedJson.replace(/\[\s+'/g, '["');
        fixes.push('array-extra-whitespace');
      }
      
      // Fix 3: Fix missing commas between array elements
      // This is critical for the position 5 error
      if (/["']\s+["']/.test(modifiedJson)) {
        modifiedJson = modifiedJson.replace(/"\s+"/g, '","');
        modifiedJson = modifiedJson.replace(/'\s+'/g, '","');
        modifiedJson = modifiedJson.replace(/"\s+'/g, '","');
        modifiedJson = modifiedJson.replace(/'\s+"/g, '","');
        fixes.push('missing-commas-between-elements');
      }
      
      // Fix 4: Prevent back-to-back JSON objects
      if (/}\s*{/.test(modifiedJson)) {
        modifiedJson = modifiedJson.replace(/}\s*{/g, '}\n{');
        fixes.push('back-to-back-objects');
      }

      // Fix 5: Handle empty array with extra spaces
      if (/\[\s+\]/.test(modifiedJson)) {
        modifiedJson = modifiedJson.replace(/\[\s+\]/g, '[]');
        fixes.push('empty-array-with-spaces');
      }

      // Fix 6: Address problematic arrays at position 5
      // Specifically target the first array in the document which is where position 5 occurs
      const earlyArrayRegex = /^([\s\S]{0,10}\[)(\s*)(.)/;
      if (earlyArrayRegex.test(modifiedJson)) {
        modifiedJson = modifiedJson.replace(earlyArrayRegex, (match, prefix, spaces, nextChar) => {
          fixes.push('position-5-array-fix');
          // Remove spaces between [ and first element
          return prefix + nextChar;
        });
      }
      
      // Fix 7: Fix arrays with mixed quotes and missing commas
      if (/\[[^,\]]{10,}/.test(modifiedJson)) {
        modifiedJson = modifiedJson.replace(/\[\s*(["'][^"']+["'])\s+(["'][^"']+["'])/g, '[$1,$2');
        fixes.push('mixed-array-missing-commas');
      }
      
      // Fix 8: Remove trailing commas in arrays (valid in JS but not JSON)
      if (/,\s*\]/.test(modifiedJson)) {
        modifiedJson = modifiedJson.replace(/,(\s*)\]/g, '$1]');
        fixes.push('trailing-commas');
      }
      
      // Fix 9: Ensure we don't have duplicate commas
      if (/,,/.test(modifiedJson)) {
        modifiedJson = modifiedJson.replace(/,\s*,/g, ',');
        fixes.push('duplicate-commas');
      }
      
      // Fix 10: Fix unquoted property names
      const propertyRegex = /(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g;
      if (propertyRegex.test(modifiedJson)) {
        modifiedJson = modifiedJson.replace(propertyRegex, '$1"$2":');
        fixes.push('unquoted-property-names');
      }
      
      // Fix 11: Fix single quoted strings
      if (/'[^']*'/.test(modifiedJson)) {
        modifiedJson = modifiedJson.replace(/'([^']*)'/g, '"$1"');
        fixes.push('single-quoted-strings');
      }

      // Log if we made any changes
      if (modifiedJson !== json) {
        logger.info(`Applied JSON fixes: ${fixes.join(', ')}`);
        
        // Debug log of before/after if needed
        logger.debug(`Before sanitization (first 100 chars): ${json.substring(0, 100)}`);
        logger.debug(`After sanitization (first 100 chars): ${modifiedJson.substring(0, 100)}`);
      }

      try {
        // Final validation - check if our fixes worked
        JSON.parse(modifiedJson);
        return modifiedJson;
      } catch (secondError) {
        // If still not valid, log error but return the modified version
        // (it might be better than the original)
        logger.error(`Failed to fully sanitize JSON: ${(secondError as Error).message}`);
        return modifiedJson;
      }
    }
    
    // For non-syntax errors, return the original
    return json;
  }
}

/**
 * Safely stringify an object with circular reference handling
 * 
 * @param obj Object to stringify
 * @returns Safe JSON string
 */
export function safeStringify(obj: any): string {
  if (!obj) return '{}';
  
  try {
    const seen = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack
        };
      }
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }
      return value;
    }, 2);
  } catch (err) {
    logger.error(`Error stringifying object: ${(err as Error).message}`);
    return `{"error": "Unable to stringify object", "message": "${(err as Error).message}"}`;
  }
}

/**
 * Safely parse JSON with error handling and sanitization
 * 
 * @param text JSON string to parse
 * @param fallback Optional fallback value if parsing fails
 * @returns Parsed object or fallback
 */
export function safeParse<T>(text: string, fallback?: T): T | null | undefined {
  if (!text) return fallback ?? null;
  
  try {
    // First try direct position 5 fix as it's a common issue
    let sanitized = fixPosition5Error(text);
    
    // If that didn't work, try full sanitization
    if (sanitized === text) {
      sanitized = sanitizeJson(text);
    }
    
    return JSON.parse(sanitized) as T;
  } catch (error) {
    logger.error(`Error parsing JSON: ${(error as Error).message}`);
    return fallback ?? null;
  }
}