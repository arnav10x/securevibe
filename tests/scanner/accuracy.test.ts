// Tests for the accuracy rebuild: CVE lookups, confidence tiers, the git-aware
// .env fix, the new detection rules, insufficient-signal grading, and
// .securevibe-ignore suppression.

import { afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanDirectory } from '@/lib/scanner';
import { checkSecretsInFile } from '@/lib/scanner/checks/secrets';
import { checkCodePatternsInFile } from '@/lib/scanner/checks/code-patterns';
import { checkDependencies } from '@/lib/scanner/checks/dependencies';
import { versionFromSpec, makeGitignoreMatcher } from '@/lib/scanner/util';
import type { WalkedFile } from '@/lib/scanner/walk';
import { fakeRegistryFetch, FIXED_NOW } from './helpers';

const tmpDirs: string[] = [];
async function makeProject(files: Record<string, string>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sv-acc-'));
  tmpDirs.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content);
  }
  return dir;
}
afterAll(async () => {
  await Promise.all(tmpDirs.map((d) => fs.rm(d, { recursive: true, force: true })));
});

describe('versionFromSpec', () => {
  it('pins exact and range-floor versions, ignores tags/urls', () => {
    expect(versionFromSpec('1.2.3')).toBe('1.2.3');
    expect(versionFromSpec('^1.2.3')).toBe('1.2.3');
    expect(versionFromSpec('~2.0')).toBe('2.0.0');
    expect(versionFromSpec('==2.31.0')).toBe('2.31.0');
    expect(versionFromSpec('v3')).toBe('3.0.0');
    expect(versionFromSpec('*')).toBeNull();
    expect(versionFromSpec('latest')).toBeNull();
  });
});

describe('makeGitignoreMatcher', () => {
  it('matches env patterns the way git would', () => {
    const m = makeGitignoreMatcher('.env\n.env.*\n/dist\nnode_modules\n');
    expect(m('.env')).toBe(true);
    expect(m('.env.local')).toBe(true);
    expect(m('src/app.ts')).toBe(false);
    expect(m('dist')).toBe(true);
  });
  it('is empty when there is no .gitignore', () => {
    const m = makeGitignoreMatcher(null);
    expect(m('.env')).toBe(false);
  });
});

describe('.env git-awareness (the false-positive fix)', () => {
  const body = 'SECRET_KEY=abc123\n';
  it('calls it COMMITTED (verified critical) for a github source', () => {
    const [f] = checkSecretsInFile('.env', body, { sourceType: 'github' });
    expect(f.severity).toBe('critical');
    expect(f.confidence).toBe('verified');
    expect(f.title).toMatch(/committed to the repository/);
  });
  it('only WARNS (not committed) for a zip upload with no .gitignore', () => {
    const [f] = checkSecretsInFile('.env', body, { sourceType: 'zip' });
    expect(f.severity).toBe('high');
    expect(f.confidence).toBe('likely');
    expect(f.title).not.toMatch(/committed to the repository/);
    expect(f.title).toMatch(/not git-ignored/);
  });
  it('downgrades to low when the zip upload git-ignores the .env', () => {
    const [f] = checkSecretsInFile('.env', body, {
      sourceType: 'zip',
      isGitignored: (p) => p === '.env',
    });
    expect(f.severity).toBe('low');
    expect(f.title).toMatch(/git-ignored/);
  });
});

describe('new detection rules', () => {
  it('flags a secret exposed via a NEXT_PUBLIC_ env var', () => {
    const findings = checkCodePatternsInFile(
      'lib/db.ts',
      'const key = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;\n',
    );
    const f = findings.find((x) => x.ruleId === 'public-env-secret');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('high');
  });
  it('does NOT flag a legitimately public anon key', () => {
    const findings = checkCodePatternsInFile(
      'lib/db.ts',
      'const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;\n',
    );
    expect(findings.find((x) => x.ruleId === 'public-env-secret')).toBeUndefined();
  });
  it('flags dangerouslySetInnerHTML fed a variable', () => {
    const findings = checkCodePatternsInFile(
      'app/post.tsx',
      'return <div dangerouslySetInnerHTML={{ __html: userBio }} />;\n',
    );
    expect(findings.find((x) => x.ruleId === 'react-dangerous-html')).toBeDefined();
  });
  it('flags a shell command built from a variable', () => {
    const findings = checkCodePatternsInFile(
      'server.js',
      'exec(`git clone ${repoUrl}`);\n',
    );
    expect(findings.find((x) => x.ruleId === 'node-command-injection')).toBeDefined();
  });
});

describe('dependency CVE lookup (OSV)', () => {
  // A fetch that reports a known vuln for lodash@4.17.11.
  const osvFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url === 'https://api.osv.dev/v1/querybatch') {
      const body = JSON.parse(String(init?.body ?? '{}'));
      const results = body.queries.map((q: { package: { name: string }; version: string }) =>
        q.package.name === 'lodash' && q.version === '4.17.11'
          ? { vulns: [{ id: 'GHSA-xxxx-lodash' }] }
          : { vulns: [] },
      );
      return new Response(JSON.stringify({ results }), { status: 200 });
    }
    if (url === 'https://api.osv.dev/v1/vulns/GHSA-xxxx-lodash') {
      return new Response(
        JSON.stringify({
          id: 'GHSA-xxxx-lodash',
          aliases: ['CVE-2019-10744'],
          summary: 'Prototype pollution in lodash',
          database_specific: { severity: 'CRITICAL' },
          references: [{ url: 'https://example.com/advisory' }],
        }),
        { status: 200 },
      );
    }
    // Fall back to the registry mock for existence/age/downloads.
    return fakeRegistryFetch(input, init);
  };

  it('reports a known CVE at the lockfile-exact version as verified', async () => {
    const files: { file: WalkedFile; content: string }[] = [
      {
        file: { relPath: 'package.json', absPath: '/x/package.json', size: 0 },
        content: JSON.stringify({ dependencies: { lodash: '^4.17.0' } }),
      },
      {
        file: { relPath: 'package-lock.json', absPath: '/x/package-lock.json', size: 0 },
        content: JSON.stringify({
          packages: { 'node_modules/lodash': { version: '4.17.11' } },
        }),
      },
    ];
    // lodash isn't in the registry mock, so add it for the existence check.
    const withLodash: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url === 'https://registry.npmjs.org/lodash') {
        return new Response(JSON.stringify({ name: 'lodash', time: { created: '2012-01-01T00:00:00Z' } }), { status: 200 });
      }
      if (url.startsWith('https://api.npmjs.org/downloads/point/last-week/lodash')) {
        return new Response(JSON.stringify({ downloads: 50_000_000 }), { status: 200 });
      }
      return osvFetch(input, init);
    };

    const res = await checkDependencies(files, { fetchImpl: withLodash, now: FIXED_NOW });
    const cve = res.findings.find((f) => f.ruleId === 'dep-known-vuln');
    expect(cve).toBeDefined();
    expect(cve!.severity).toBe('critical');
    expect(cve!.confidence).toBe('verified'); // exact version came from the lockfile
    expect(cve!.explanation).toContain('CVE-2019-10744');
  });

  it('does not run the CVE lookup when skipVulnerabilityLookup is set', async () => {
    const files: { file: WalkedFile; content: string }[] = [
      {
        file: { relPath: 'package.json', absPath: '/x/package.json', size: 0 },
        content: JSON.stringify({ dependencies: { react: '^18.0.0' } }),
      },
    ];
    const res = await checkDependencies(files, {
      fetchImpl: fakeRegistryFetch,
      now: FIXED_NOW,
      skipVulnerabilityLookup: true,
    });
    expect(res.findings.find((f) => f.ruleId === 'dep-known-vuln')).toBeUndefined();
  });
});

describe('grading: insufficient signal and suppression, end to end', () => {
  it('does NOT award A+ to a repo with no real code', async () => {
    const dir = await makeProject({ 'README.md': '# just docs\n' });
    const res = await scanDirectory(dir, { fetchImpl: fakeRegistryFetch, now: FIXED_NOW });
    expect(res.stats.report!.insufficientSignal).toBe(true);
    expect(res.stats.report!.securityGrade).toBe('—');
  });

  it('suppresses findings listed in .securevibe-ignore', async () => {
    const withSecret = {
      'app/config.ts': 'const k = "AKIAIOSFODNN7EXAMPLE";\n',
    };
    const before = await scanDirectory(
      await makeProject(withSecret),
      { fetchImpl: fakeRegistryFetch, now: FIXED_NOW },
    );
    expect(before.findings.some((f) => f.ruleId === 'aws-access-key')).toBe(true);

    const after = await scanDirectory(
      await makeProject({ ...withSecret, '.securevibe-ignore': 'rule:aws-access-key\n' }),
      { fetchImpl: fakeRegistryFetch, now: FIXED_NOW },
    );
    expect(after.findings.some((f) => f.ruleId === 'aws-access-key')).toBe(false);
    expect(after.stats.notes.some((n) => n.includes('suppressed'))).toBe(true);
  });
});
