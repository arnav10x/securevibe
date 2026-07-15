import { describe, expect, it } from 'vitest';
import {
  parsePackageJson,
  parseRequirementsTxt,
} from '@/lib/scanner/checks/dependencies';

describe('parsePackageJson', () => {
  it('collects deps and devDeps, skipping non-registry specs', () => {
    const refs = parsePackageJson(
      'package.json',
      JSON.stringify({
        dependencies: {
          react: '^18.0.0',
          '@scoped/pkg': '1.0.0',
          'local-thing': 'file:../local',
          'git-thing': 'git+https://github.com/x/y.git',
        },
        devDependencies: { vitest: '^1.0.0' },
      }),
    );
    const names = refs.map((r) => r.name);
    expect(names).toContain('react');
    expect(names).toContain('@scoped/pkg');
    expect(names).toContain('vitest');
    expect(names).not.toContain('local-thing');
    expect(names).not.toContain('git-thing');
  });

  it('returns nothing for invalid JSON', () => {
    expect(parsePackageJson('package.json', '{oops')).toEqual([]);
  });
});

describe('parseRequirementsTxt', () => {
  it('handles version specifiers, extras, comments and flags', () => {
    const refs = parseRequirementsTxt(
      'requirements.txt',
      [
        '# a comment',
        'requests==2.31.0',
        'flask>=2.0',
        'celery[redis]~=5.3',
        '-r other-requirements.txt',
        '--hash=sha256:abc',
        'git+https://github.com/x/y.git',
        '',
        'numpy  # inline comment',
      ].join('\n'),
    );
    expect(refs.map((r) => r.name)).toEqual(['requests', 'flask', 'celery', 'numpy']);
    expect(refs.every((r) => r.registry === 'pypi')).toBe(true);
  });
});
