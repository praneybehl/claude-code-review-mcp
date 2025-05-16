import { describe, it, expect, vi } from 'vitest';
import { getGitDiff } from '../src/git-utils.js';
import { execSync } from 'child_process';

// Mock the child_process module
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('git-utils module', () => {
  describe('getGitDiff()', () => {
    it('should throw an error if not in a git repository', () => {
      // Mock the execSync to throw an error for the git repo check
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('Not a git repository');
      });
      
      expect(() => getGitDiff('HEAD')).toThrow(/not a git repository/i);
    });
    
    it('should handle staged changes correctly', () => {
      // Mock successful git repo check
      vi.mocked(execSync).mockImplementationOnce(() => Buffer.from('true'));
      
      // Mock the diff command
      vi.mocked(execSync).mockImplementationOnce(() => 
        Buffer.from('diff --git a/file.js b/file.js\nsample diff output')
      );
      
      const result = getGitDiff('staged');
      expect(result).toContain('sample diff output');
    });
    
    it('should return "No changes found" message when diff is empty', () => {
      // Mock successful git repo check
      vi.mocked(execSync).mockImplementationOnce(() => Buffer.from('true'));
      
      // Mock empty diff output
      vi.mocked(execSync).mockImplementationOnce(() => Buffer.from(''));
      
      const result = getGitDiff('HEAD');
      expect(result).toBe('No changes found for the specified target.');
    });
  });
});
