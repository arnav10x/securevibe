import { describe, expect, it } from 'vitest';
import { parseGitHubUrl, AcquireError } from '@/lib/scanner/acquire/github-tarball';

describe('parseGitHubUrl', () => {
  it('parses a plain repo URL', () => {
    expect(parseGitHubUrl('https://github.com/vercel/next.js')).toEqual({
      owner: 'vercel',
      repo: 'next.js',
      ref: undefined,
    });
  });

  it('strips a trailing .git', () => {
    expect(parseGitHubUrl('https://github.com/foo/bar.git').repo).toBe('bar');
  });

  it('extracts a branch from /tree/<ref>', () => {
    expect(parseGitHubUrl('https://github.com/foo/bar/tree/develop').ref).toBe('develop');
  });

  it('handles branch names containing slashes', () => {
    expect(parseGitHubUrl('https://github.com/foo/bar/tree/feat/new-ui').ref).toBe('feat/new-ui');
  });

  it('tolerates www and trailing slashes', () => {
    expect(parseGitHubUrl('https://www.github.com/foo/bar/').repo).toBe('bar');
  });

  it('rejects non-GitHub hosts', () => {
    expect(() => parseGitHubUrl('https://gitlab.com/foo/bar')).toThrow(AcquireError);
  });

  it('rejects URLs without a repo', () => {
    expect(() => parseGitHubUrl('https://github.com/onlyowner')).toThrow(AcquireError);
  });

  it('rejects garbage', () => {
    expect(() => parseGitHubUrl('not a url at all')).toThrow(AcquireError);
  });
});
