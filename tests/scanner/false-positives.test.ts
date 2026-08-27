// Regression tests for the false positives found by scanning SecureVibe
// with SecureVibe. Every case here was once reported as a real problem, and
// each pair asserts the same thing: the wrong finding is gone AND the right
// finding still fires. Precision that costs recall is not precision.
//
// SECUREVIBE.md 1.12: a wrong finding with a confident tone costs more trust
// than five missed findings, because the reader can verify a citation in ten
// seconds and cannot verify a vibe.

import { describe, expect, it } from 'vitest';
import { checkSecretsInFile } from '@/lib/scanner/checks/secrets';
import { checkCodePatternsInFile } from '@/lib/scanner/checks/code-patterns';
import { checkPlatformConfigInFile } from '@/lib/scanner/checks/platform-config';
import { DesignAnalyzer } from '@/lib/scanner/checks/design';
import { assessSecurity } from '@/lib/scanner/grade';
import type { Finding } from '@/lib/scanner/types';

const ids = (findings: Finding[]) => findings.map((f) => f.ruleId);

// Assembled at runtime so the literal never appears in this file. A test that
// needs a realistic key would otherwise trip GitHub's push protection, which
// is the same fixture-versus-real-secret problem these tests are about.
const FAKE_LIVE_KEY = ['sk', 'live', '9Xk2Qw7ZrTn4Bv8Lp3Hs6Ydm'].join('_');
/** The sequential-run shape that documentation uses to show a key format. */
const DOC_EXAMPLE_KEY = ['sk', 'live', 'abc123def456ghi789'].join('_');

describe('secrets: documentation examples versus real keys', () => {
  it('ignores a made-up key used to document a format in a comment', () => {
    const line = ` * "${DOC_EXAMPLE_KEY}" -> "sk_live_ab**********"\n`;
    expect(ids(checkSecretsInFile('lib/util.ts', line))).not.toContain('stripe-live-key');
  });

  it('still flags a REAL key pasted into a comment', () => {
    const line = `// old key was ${FAKE_LIVE_KEY}\n`;
    expect(ids(checkSecretsInFile('lib/util.ts', line))).toContain('stripe-live-key');
  });

  it('ignores a rule file that defines what a key looks like', () => {
    const line = "    regex: /\\b(sk_live_[0-9a-zA-Z]{16,})\\b/,\n";
    expect(checkSecretsInFile('rules/secrets.ts', line)).toHaveLength(0);
  });

  it('downgrades a key inside a git-ignored file and says so', () => {
    const found = checkSecretsInFile('.env.local', `STRIPE=${FAKE_LIVE_KEY}\n`, {
      sourceType: 'zip',
      isGitignored: (p) => p === '.env.local',
    }).find((f) => f.ruleId === 'stripe-live-key');
    expect(found?.severity).toBe('low');
    expect(found?.title).toMatch(/git-ignored/);
  });
});

describe('code patterns: described versus executed', () => {
  it('ignores a rule title that names the dangerous call', () => {
    const line = "    title: 'new Function() used to build code from strings',\n";
    expect(checkCodePatternsInFile('rules.ts', line)).toHaveLength(0);
  });

  it('ignores prose explaining why a call is dangerous', () => {
    const line = "      'new Function() is eval() in disguise: it turns strings into code. ' +\n";
    expect(checkCodePatternsInFile('rules.ts', line)).toHaveLength(0);
  });

  it('ignores a recommendation showing the SAFE form', () => {
    const line =
      "      'dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value) }}.',\n";
    expect(checkCodePatternsInFile('rules.ts', line)).toHaveLength(0);
  });

  it('still flags the real calls', () => {
    expect(ids(checkCodePatternsInFile('a.ts', 'const f = new Function(src);\n'))).toContain(
      'new-function',
    );
    expect(ids(checkCodePatternsInFile('a.ts', 'eval(userInput);\n'))).toContain('eval-dynamic');
  });
});

describe('dangerouslySetInnerHTML: constant versus interpolated', () => {
  it('ignores a fixed string with no interpolation', () => {
    const line =
      "<script dangerouslySetInnerHTML={{ __html: `document.documentElement.classList.add('js')` }} />\n";
    expect(ids(checkCodePatternsInFile('layout.tsx', line))).not.toContain('react-dangerous-html');
  });

  it('ignores a plain quoted constant', () => {
    const line = '<div dangerouslySetInnerHTML={{ __html: "<b>hi</b>" }} />\n';
    expect(ids(checkCodePatternsInFile('a.tsx', line))).not.toContain('react-dangerous-html');
  });

  it('still flags a variable', () => {
    const line = '<div dangerouslySetInnerHTML={{ __html: userBio }} />\n';
    expect(ids(checkCodePatternsInFile('a.tsx', line))).toContain('react-dangerous-html');
  });

  it('still flags an interpolated template', () => {
    const line = '<div dangerouslySetInnerHTML={{ __html: `<p>${userBio}</p>` }} />\n';
    expect(ids(checkCodePatternsInFile('a.tsx', line))).toContain('react-dangerous-html');
  });
});

describe('SQL rules require SQL structure, not a bare keyword', () => {
  it('ignores ordinary prose that happens to start with a SQL verb', () => {
    const line = '  `Update "${name}" to a patched version (run npm audit fix)` +\n';
    expect(ids(checkCodePatternsInFile('a.ts', line))).not.toContain('sql-template-literal');
  });

  it('still flags a real interpolated query', () => {
    const line = 'db.query(`SELECT * FROM users WHERE id = ${id}`);\n';
    expect(ids(checkCodePatternsInFile('a.ts', line))).toContain('sql-template-literal');
  });

  it('still flags a real UPDATE with SET', () => {
    const line = 'db.query(`UPDATE users SET name = ${name}`);\n';
    expect(ids(checkCodePatternsInFile('a.ts', line))).toContain('sql-template-literal');
  });
});

describe('RLS policies: everyone versus every signed-in user', () => {
  const policy = (to: string) =>
    `create policy "p" on public.t for select\n  ${to}\n  using (true);\n`;

  it('calls an unrestricted policy readable by everyone', () => {
    const f = checkPlatformConfigInFile('m.sql', policy(''))[0];
    expect(f.ruleId).toBe('policy-public-read');
    expect(f.severity).toBe('medium');
  });

  it('narrows an authenticated-only policy and lowers the severity', () => {
    const f = checkPlatformConfigInFile('m.sql', policy('to authenticated'))[0];
    expect(f.ruleId).toBe('policy-any-user-read');
    expect(f.severity).toBe('low');
    expect(f.title).toMatch(/signed-in/);
  });
});

describe('design: decoration, labels, and custom scales', () => {
  function analyze(files: Record<string, string>) {
    const d = new DesignAnalyzer();
    for (const [p, c] of Object.entries(files)) d.addFile(p, c);
    return d.finish();
  }

  it('ignores fixed size on an aria-hidden decorative shape', () => {
    const audit = analyze({
      'app/page.tsx':
        '<div aria-hidden className="pointer-events-none absolute h-[680px] w-[680px]" />\n',
    });
    expect(ids(audit.findings)).not.toContain('layout-fixed-width');
    expect(ids(audit.findings)).not.toContain('layout-fixed-height');
  });

  it('still flags a fixed width on a real content container', () => {
    const audit = analyze({
      'app/page.tsx': '<section className="w-[680px]">{children}</section>\n',
    });
    expect(ids(audit.findings)).toContain('layout-fixed-width');
  });

  it('ignores 10px on an uppercase tracked label', () => {
    const audit = analyze({
      'app/page.tsx': '<span className="uppercase tracking-[0.16em] text-[10px]">Scan</span>\n',
    });
    expect(ids(audit.findings)).not.toContain('type-below-floor');
  });

  it('ignores 10px on a label class the project CSS defines as tracked', () => {
    const audit = analyze({
      'app/globals.css': '.tag { text-transform: uppercase; letter-spacing: 0.12em; }\n',
      'app/page.tsx': '<span className="tag text-[10px]">Preview</span>\n',
    });
    expect(ids(audit.findings)).not.toContain('type-below-floor');
  });

  it('still flags small untracked body text', () => {
    const audit = analyze({
      'app/page.tsx': '<p className="text-[10px] text-gray-500">Some readable prose here</p>\n',
    });
    expect(ids(audit.findings)).toContain('type-below-floor');
  });

  it('treats a size used across the project as a scale step, not a one-off', () => {
    const many = Array.from(
      { length: 6 },
      (_, i) => [`app/p${i}.tsx`, `<p className="text-[15px]">line ${i}</p>\n`] as const,
    );
    const audit = analyze(Object.fromEntries(many));
    expect(ids(audit.findings)).not.toContain('type-offscale-size');
  });

  it('still flags a genuinely one-off size', () => {
    const audit = analyze({ 'app/page.tsx': '<p className="text-[13px]">once</p>\n' });
    expect(ids(audit.findings)).toContain('type-offscale-size');
  });

  it('does not count a TODO that only appears inside rule prose', () => {
    const audit = analyze({
      'lib/rules.ts':
        Array.from({ length: 8 }, () => "  explanation: 'A TODO marker means unfinished work here',\n").join(''),
    });
    expect(ids(audit.findings)).not.toContain('copy-todo-debris');
  });
});

describe('grading keeps test fixtures out of the headline', () => {
  const planted = (path: string): Finding => ({
    checkType: 'secret',
    severity: 'critical',
    confidence: 'verified',
    ruleId: 'stripe-live-key',
    title: 'Stripe LIVE secret key committed to code',
    explanation: 'e',
    recommendation: 'r',
    filePath: path,
  });

  it('counts fixture findings separately and leaves the tally clean', () => {
    const a = assessSecurity([
      planted('tests/fixtures/vulnerable-app/.env'),
      planted('tests/scanner/scan.test.ts'),
    ]);
    expect(a.tally.critical).toBe(0);
    expect(a.testOnlyCount).toBe(2);
    expect(a.clean).toBe(true);
    expect(a.capReason).toBeNull();
  });

  it('still counts a real one in shipped code', () => {
    const a = assessSecurity([planted('lib/config.ts')]);
    expect(a.tally.critical).toBe(1);
    expect(a.testOnlyCount).toBe(0);
    expect(a.grade).toBe('F');
  });
});
