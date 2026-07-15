// Rules for Check 4: common insecure code patterns.
// Line-based regex heuristics, scoped by file extension to limit noise.

import type { Severity } from '../types';

export interface PatternRule {
  id: string;
  title: string;
  severity: Severity;
  regex: RegExp;
  /** File extensions this rule applies to (with the dot). */
  extensions: Set<string>;
  explanation: string;
  recommendation: string;
}

const JS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte']);
const PY = new Set(['.py']);
const JS_AND_PY = new Set([...JS, ...PY]);

export const PATTERN_RULES: PatternRule[] = [
  {
    id: 'eval-dynamic',
    title: 'eval() called on a dynamic value',
    severity: 'high',
    // eval( followed by something that is NOT a string literal
    regex: /\beval\s*\(\s*(?!["'`)])/,
    extensions: JS_AND_PY,
    explanation:
      'eval() runs whatever text it is given as real code. If any user input ' +
      'can reach this call — even indirectly — an attacker can run their own ' +
      'code inside your app: stealing data, credentials, or taking it over.',
    recommendation:
      'Almost every use of eval() has a safer replacement: JSON.parse() for ' +
      'data, a lookup table for dynamic behavior, or a proper parser. Remove ' +
      'eval() and handle the input as data, never as code.',
  },
  {
    id: 'new-function',
    title: 'new Function() used to build code from strings',
    severity: 'high',
    regex: /\bnew\s+Function\s*\(/,
    extensions: JS,
    explanation:
      'new Function() is eval() in disguise: it turns strings into runnable ' +
      'code. If user input reaches it, attackers can execute arbitrary code.',
    recommendation:
      'Replace it with ordinary functions or a data-driven approach ' +
      '(lookup tables, JSON configs). Treat input as data, never as code.',
  },
  {
    id: 'python-exec-dynamic',
    title: 'exec() called on a dynamic value',
    severity: 'high',
    regex: /\bexec\s*\(\s*(?!["'])/,
    extensions: PY,
    explanation:
      'exec() runs its argument as Python code. If user input can reach it, ' +
      'an attacker can run arbitrary commands on your server.',
    recommendation:
      'Remove exec(). Use dictionaries for dynamic dispatch, ast.literal_eval ' +
      'for safe literal parsing, or restructure so input is only ever data.',
  },
  {
    id: 'sql-string-concat',
    title: 'SQL query built with string concatenation',
    severity: 'high',
    regex: /(["'])\s*(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^"']*\1\s*\+/i,
    extensions: JS,
    explanation:
      'This SQL query is glued together with + from pieces of text. If any ' +
      'of those pieces comes from a user, they can inject their own SQL — ' +
      'the classic attack that dumps or deletes entire databases.',
    recommendation:
      'Use parameterized queries: db.query("SELECT ... WHERE id = $1", [id]). ' +
      'The database then treats input strictly as a value, never as SQL.',
  },
  {
    id: 'sql-template-literal',
    title: 'SQL query built with template-string interpolation',
    severity: 'high',
    regex: /`[^`]*\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^`]*\$\{/i,
    extensions: JS,
    explanation:
      'This SQL query has a ${...} variable directly inside it. If that ' +
      'variable ever contains user input, an attacker can rewrite your query ' +
      '(SQL injection) and read or destroy data.',
    recommendation:
      'Use parameterized queries: db.query("SELECT ... WHERE id = $1", [id]) ' +
      'instead of template strings.',
  },
  {
    id: 'python-sql-fstring',
    title: 'SQL query built with an f-string',
    severity: 'high',
    regex: /f["'][^"']*\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^"']*\{/i,
    extensions: PY,
    explanation:
      'This SQL query has a Python f-string variable inside it. If user ' +
      'input reaches that variable, an attacker can inject SQL and read or ' +
      'destroy your data.',
    recommendation:
      'Use parameterized queries: cursor.execute("SELECT ... WHERE name = %s", (name,)).',
  },
  {
    id: 'python-sql-format',
    title: 'SQL query built with %-formatting or .format()',
    severity: 'high',
    regex: /["'][^"']*\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b[^"']*["']\s*(?:%\s*\(|\.format\s*\()/i,
    extensions: PY,
    explanation:
      'This SQL query is assembled with string formatting. If user input ' +
      'reaches it, the query can be rewritten by an attacker (SQL injection).',
    recommendation:
      'Pass values as parameters to execute() instead of formatting them ' +
      'into the SQL string.',
  },
  {
    id: 'tls-reject-unauthorized',
    title: 'TLS certificate verification is disabled',
    severity: 'medium',
    regex: /rejectUnauthorized\s*:\s*false/,
    extensions: JS,
    explanation:
      'rejectUnauthorized: false tells Node to accept ANY certificate, ' +
      'including a forged one. Anyone positioned between your app and the ' +
      'server (public Wi-Fi, compromised network) can read and modify the ' +
      'traffic — including credentials and API keys in transit.',
    recommendation:
      'Remove it. If you hit certificate errors in development, fix the cert ' +
      'or trust it explicitly via NODE_EXTRA_CA_CERTS — never disable ' +
      'verification globally.',
  },
  {
    id: 'node-tls-env',
    title: 'TLS verification disabled via NODE_TLS_REJECT_UNAUTHORIZED',
    severity: 'medium',
    regex: /NODE_TLS_REJECT_UNAUTHORIZED[^\n]*=\s*["']?0/,
    extensions: new Set([...JS, '.sh', '.yml', '.yaml', '.dockerfile', '']),
    explanation:
      'Setting NODE_TLS_REJECT_UNAUTHORIZED=0 turns off HTTPS certificate ' +
      'checking for the entire process. All encrypted traffic can then be ' +
      'intercepted by an attacker on the network path.',
    recommendation:
      'Remove this setting. Fix the underlying certificate problem instead.',
  },
  {
    id: 'python-verify-false',
    title: 'TLS certificate verification disabled (verify=False)',
    severity: 'medium',
    regex: /\bverify\s*=\s*False\b/,
    extensions: PY,
    explanation:
      'verify=False makes this HTTPS request accept any certificate, so an ' +
      'attacker on the network can intercept and modify the traffic.',
    recommendation:
      'Remove verify=False. If you need a custom CA, pass verify="/path/to/ca.pem".',
  },
  {
    id: 'browser-storage-auth',
    title: 'Auth/role state trusted from browser storage',
    severity: 'medium',
    regex: /(?:localStorage|sessionStorage)\.(?:get|set)Item\(\s*["'](?:role|isAdmin|is_admin|admin|userRole|user_role|isLoggedIn|logged_in|auth)["']/i,
    extensions: JS,
    explanation:
      'This code stores or reads login/role state from browser storage. ' +
      'Anyone can open DevTools and set isAdmin to true — the browser is the ' +
      'user\'s territory, and nothing there can be trusted. If the server ' +
      'does not independently verify the role, this is a broken access control.',
    recommendation:
      'Keep the role in your database, attach identity via a server-verified ' +
      'session (cookie/JWT), and check permissions on the SERVER for every ' +
      'sensitive action. Client-side checks are for UX only.',
  },
  {
    id: 'hardcoded-password-compare',
    title: 'Password compared against a hardcoded value',
    severity: 'high',
    regex: /\b(?:password|passwd|pwd)\s*===?\s*["'][^"']{4,}["']/i,
    extensions: JS_AND_PY,
    explanation:
      'The code checks a password by comparing it to a fixed string. That ' +
      'password is now visible to everyone who can read the code, and it can ' +
      'never be changed without redeploying.',
    recommendation:
      'Use a real authentication system (e.g. your platform\'s auth provider) ' +
      'or store salted password hashes (bcrypt/argon2) — never the password ' +
      'itself, and never in code.',
  },
];
