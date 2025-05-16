import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getApiKey, LLMProvider } from '../src/config.js';

// Setup and restore environment variables for tests
describe('config module', () => {
  // Save original env values
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    // Setup test environment variables before each test
    vi.stubEnv('GOOGLE_API_KEY', 'mock-google-api-key');
    vi.stubEnv('OPENAI_API_KEY', 'mock-openai-api-key');
    vi.stubEnv('ANTHROPIC_API_KEY', 'mock-anthropic-api-key');
  });
  
  afterEach(() => {
    // Restore original environment after each test
    process.env = originalEnv;
    vi.unstubAllEnvs();
  });
  
  describe('getApiKey()', () => {
    it('should return the correct API key for Google provider', () => {
      const key = getApiKey('google');
      expect(key).toBe('mock-google-api-key');
    });

    it('should return the correct API key for OpenAI provider', () => {
      const key = getApiKey('openai');
      expect(key).toBe('mock-openai-api-key');
    });

    it('should return the correct API key for Anthropic provider', () => {
      const key = getApiKey('anthropic');
      expect(key).toBe('mock-anthropic-api-key');
    });
    
    it('should use GEMINI_API_KEY as fallback when GOOGLE_API_KEY is not available', () => {
      // Reset the Google API key and set Gemini key instead
      vi.stubEnv('GOOGLE_API_KEY', '');
      vi.stubEnv('GEMINI_API_KEY', 'mock-gemini-fallback-key');
      
      const key = getApiKey('google');
      expect(key).toBe('mock-gemini-fallback-key');
    });
    
    it('should return undefined when no API key is available for a provider', () => {
      // Clear all API keys
      vi.stubEnv('GOOGLE_API_KEY', '');
      vi.stubEnv('GEMINI_API_KEY', '');
      vi.stubEnv('OPENAI_API_KEY', '');
      
      const googleKey = getApiKey('google');
      const openaiKey = getApiKey('openai');
      
      expect(googleKey).toBeUndefined();
      expect(openaiKey).toBeUndefined();
    });
  });
});
