// Rules for Check 1: hardcoded secrets.
// Each rule is one kind of credential. Adding a new secret type = adding
// one entry here; the engine in checks/secrets.ts does the rest.

import type { Severity } from '../types';

export interface SecretRule {
  id: string;
  title: string;
  severity: Severity;
  /** Must contain ONE capture group: the secret value itself. */
  regex: RegExp;
  explanation: string;
  recommendation: string;
  /** If true, the captured value must also look random (high entropy). */
  requiresEntropy?: boolean;
}

const MOVE_TO_ENV =
  'Remove it from the code, revoke/rotate the credential with the provider, ' +
  'and load it from an environment variable instead (e.g. process.env.MY_KEY). ' +
  'Rotating is essential: once a secret has been committed, treat it as stolen.';

export const SECRET_RULES: SecretRule[] = [
  {
    id: 'aws-access-key',
    title: 'AWS access key committed to code',
    severity: 'critical',
    regex: /\b((?:AKIA|ASIA|ABIA|ACCA)[0-9A-Z]{16})\b/,
    explanation:
      'This looks like an Amazon Web Services access key. Anyone who finds it ' +
      'can use your AWS account: spin up servers on your credit card, read ' +
      'your data, or delete your infrastructure. Bots scan public code for ' +
      'these keys within minutes of publication.',
    recommendation: MOVE_TO_ENV,
  },
  {
    id: 'stripe-live-key',
    title: 'Stripe LIVE secret key committed to code',
    severity: 'critical',
    regex: /\b(sk_live_[0-9a-zA-Z]{16,})\b/,
    explanation:
      'This is a live-mode Stripe secret key. Anyone holding it can issue ' +
      'refunds, read customer data, and move real money in your Stripe account.',
    recommendation: MOVE_TO_ENV,
  },
  {
    id: 'stripe-restricted-key',
    title: 'Stripe restricted key committed to code',
    severity: 'critical',
    regex: /\b(rk_live_[0-9a-zA-Z]{16,})\b/,
    explanation:
      'This is a live-mode restricted Stripe key. Even with limited scope it ' +
      'grants real access to your payments account.',
    recommendation: MOVE_TO_ENV,
  },
  {
    id: 'stripe-test-key',
    title: 'Stripe test secret key committed to code',
    severity: 'medium',
    regex: /\b(sk_test_[0-9a-zA-Z]{16,})\b/,
    explanation:
      'This is a test-mode Stripe key, so no real money is at risk — but ' +
      'committing test keys is how live keys end up committed later. It also ' +
      'lets strangers pollute your test data.',
    recommendation: MOVE_TO_ENV,
  },
  {
    id: 'github-token',
    title: 'GitHub token committed to code',
    severity: 'critical',
    regex: /\b((?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,})\b/,
    explanation:
      'This looks like a GitHub access token. Depending on its permissions it ' +
      'can read or modify your repositories, or act as you on GitHub.',
    recommendation: MOVE_TO_ENV,
  },
  {
    id: 'github-fine-grained-token',
    title: 'GitHub fine-grained token committed to code',
    severity: 'critical',
    regex: /\b(github_pat_[A-Za-z0-9_]{22,})\b/,
    explanation:
      'This looks like a fine-grained GitHub personal access token. It can ' +
      'grant read or write access to your repositories.',
    recommendation: MOVE_TO_ENV,
  },
  {
    id: 'anthropic-key',
    title: 'Anthropic API key committed to code',
    severity: 'critical',
    regex: /\b(sk-ant-[A-Za-z0-9_-]{20,})\b/,
    explanation:
      'This looks like an Anthropic (Claude) API key. Anyone who finds it can ' +
      'run up API charges billed to your account.',
    recommendation: MOVE_TO_ENV,
  },
  {
    id: 'openai-key',
    title: 'OpenAI-style API key committed to code',
    severity: 'critical',
    // sk- but not sk_live/sk_test (Stripe) and not sk-ant (Anthropic, above)
    regex: /\b(sk-(?!ant-)[A-Za-z0-9_-]{20,})\b/,
    explanation:
      'This looks like an OpenAI API key. Anyone who finds it can run up API ' +
      'charges billed to your account.',
    recommendation: MOVE_TO_ENV,
  },
  {
    id: 'google-api-key',
    title: 'Google API key committed to code',
    severity: 'high',
    regex: /\b(AIza[0-9A-Za-z_-]{35})\b/,
    explanation:
      'This looks like a Google API key. Some Google keys are designed to be ' +
      'public (like Maps browser keys), but many grant billable or private ' +
      'access. Unless you are certain this one is restricted, treat it as leaked.',
    recommendation:
      'Check the key in the Google Cloud console. If it grants anything beyond ' +
      'public, quota-restricted browser use: revoke it, create a restricted ' +
      'replacement, and load it from an environment variable.',
  },
  {
    id: 'slack-token',
    title: 'Slack token committed to code',
    severity: 'critical',
    regex: /\b(xox[baprs]-[0-9A-Za-z-]{10,})\b/,
    explanation:
      'This looks like a Slack token. It can read or post messages in your ' +
      'workspace as your app or as you.',
    recommendation: MOVE_TO_ENV,
  },
  {
    id: 'supabase-secret-key',
    title: 'Supabase secret key committed to code',
    severity: 'critical',
    regex: /\b(sb_secret_[A-Za-z0-9_-]{20,})\b/,
    explanation:
      'This is a Supabase SECRET key. Unlike the publishable key, this one ' +
      'bypasses all Row Level Security — anyone holding it can read and ' +
      'modify every row in your database.',
    recommendation: MOVE_TO_ENV,
  },
  {
    id: 'private-key-block',
    title: 'Private key file committed to code',
    severity: 'critical',
    regex: /(-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----)/,
    explanation:
      'This is a cryptographic private key. Whoever holds it can impersonate ' +
      'your server, decrypt traffic, or sign as you, depending on its use.',
    recommendation:
      'Remove the key from the repository, generate a new key pair, and ' +
      'distribute the private key through a secrets manager or environment ' +
      'configuration — never through git.',
  },
  {
    id: 'connection-string-password',
    title: 'Database connection string with password committed to code',
    severity: 'critical',
    regex:
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@'"`]+:([^\s@'"`]{4,})@[^\s'"`]+/,
    explanation:
      'This connection string contains a database username and password. ' +
      'Anyone who finds it can connect directly to your database, bypassing ' +
      'your app entirely — reading, changing, or deleting all data.',
    recommendation:
      'Change the database password immediately, then load the connection ' +
      'string from an environment variable (e.g. process.env.DATABASE_URL).',
  },
  {
    id: 'generic-assigned-secret',
    title: 'Possible hardcoded credential',
    severity: 'high',
    regex:
      /(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|auth[_-]?token|access[_-]?key|client[_-]?secret)["']?\s*[:=]\s*["']([^"']{8,})["']/i,
    requiresEntropy: true,
    explanation:
      'A variable with a credential-like name is assigned a random-looking ' +
      'value directly in the code. If this is a real secret, everyone with ' +
      'access to the code (or the git history) has it.',
    recommendation:
      'If this is a real credential: rotate it and move it to an environment ' +
      'variable. If it is a placeholder, consider renaming it (e.g. ' +
      '"example-key") so scanners and humans can tell.',
  },
];

/**
 * Files whose basename matches this are committed environment files — a
 * critical finding on their own, before we even look inside.
 */
export const ENV_FILE_PATTERN = /^\.env(\..+)?$/;

/** ...except these, which are meant to be committed. */
export const ENV_EXAMPLE_PATTERN = /^\.env\.(example|sample|template|defaults)$/;
