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
  });
});
