import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getGitDiff } from '../src/git-utils.js';
import { execSync } from 'child_process';

// Mock the child_process module
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

describe('git-utils module', () => {
  beforeEach(() => {
    // Reset mocks between tests
    vi.resetAllMocks();
  });
  
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
      
      // Mock the diff command - this is the second execSync call in the function
      vi.mocked(execSync).mockImplementationOnce(() => 
        Buffer.from('diff --git a/file.js b/file.js\nsample diff output')
      );
      
      const result = getGitDiff('staged');
      expect(result).toContain('sample diff output');
    });
    
    it('should handle HEAD changes correctly', () => {
      // Mock successful git repo check
      vi.mocked(execSync).mockImplementationOnce(() => Buffer.from('true'));
      
      // Mock the diff command - this is the second execSync call in the function
      vi.mocked(execSync).mockImplementationOnce(() => 
        Buffer.from('diff --git a/file.js b/file.js\nHEAD diff output')
      );
      
      const result = getGitDiff('HEAD');
      expect(result).toContain('HEAD diff output');
    });
    
    it('should return "No changes found" message when diff is empty', () => {
      // Mock successful git repo check
      vi.mocked(execSync).mockImplementationOnce(() => Buffer.from('true'));
      
      // Mock empty diff output - this is the second execSync call
      vi.mocked(execSync).mockImplementationOnce(() => Buffer.from(''));
      
      const result = getGitDiff('HEAD');
      expect(result).toBe('No changes found for the specified target.');
    });
    
    it('should handle branch_diff correctly with successful fetch', () => {
      // Mock successful git repo check
      vi.mocked(execSync).mockImplementationOnce(() => Buffer.from('true'));
      
      // Mock successful git fetch
      vi.mocked(execSync).mockImplementationOnce(() => Buffer.from(''));
      
      // Mock the diff command
      vi.mocked(execSync).mockImplementationOnce(() => 
        Buffer.from('diff --git a/file.js b/file.js\nbranch diff output')
      );
      
      const result = getGitDiff('branch_diff', 'main');
      expect(result).toContain('branch diff output');
    });
    
    it('should proceed with branch_diff even if fetch fails', () => {
      // Mock successful git repo check
      vi.mocked(execSync).mockImplementationOnce(() => Buffer.from('true'));
      
      // Mock failed git fetch
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('fetch failed');
      });
      
      // Mock the diff command
      vi.mocked(execSync).mockImplementationOnce(() => 
        Buffer.from('diff --git a/file.js b/file.js\nlocal branch diff output')
      );
      
      const result = getGitDiff('branch_diff', 'main');
      expect(result).toContain('local branch diff output');
    });
    
    it('should throw error for branch_diff with empty baseBranch', () => {
      // Mock successful git repo check
      vi.mocked(execSync).mockImplementationOnce(() => Buffer.from('true'));
      
      expect(() => getGitDiff('branch_diff', '')).toThrow(/required for 'branch_diff'/i);
    });
    
    it('should throw error for branch_diff with invalid characters', () => {
      // Mock successful git repo check
      vi.mocked(execSync).mockImplementationOnce(() => Buffer.from('true'));
      
      expect(() => getGitDiff('branch_diff', 'main;rm -rf /')).toThrow(/invalid characters in base branch/i);
    });
    
    it('should sanitize branch name correctly', () => {
      // Mock successful git repo check
      vi.mocked(execSync).mockImplementationOnce(() => Buffer.from('true'));
      
      // Mock successful git fetch - check that command has sanitized branch
      vi.mocked(execSync).mockImplementationOnce((command) => {
        expect(command).toContain('git fetch origin feature/branch:feature/branch');
        return Buffer.from('');
      });
      
      // Mock the diff command - check that command has sanitized branch
      vi.mocked(execSync).mockImplementationOnce((command) => {
        expect(command).toContain('git diff feature/branch...HEAD');
        return Buffer.from('branch diff output');
      });
      
      const result = getGitDiff('branch_diff', 'feature/branch');
      expect(result).toContain('branch diff output');
    });
  });
});
