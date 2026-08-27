// Rules for Check 4: common insecure code patterns.
// Line-based regex heuristics, scoped by file extension to limit noise.

import type { Confidence, Severity } from '../types';

export interface PatternRule {
  id: string;
  title: string;
  severity: Severity;
  regex: RegExp;
  /** File extensions this rule applies to (with the dot). */
  extensions: Set<string>;
  explanation: string;
  recommendation: string;
  /** How sure a plain match is. Defaults to 'heuristic'. */
  confidence?: Confidence;
  /**
   * For injection rules: if the matched line ALSO contains a known dangerous
   * sink (a real db.query/exec call), the match is upgraded from a guess to
   * 'likely'. This is the cheap stand-in for AST taint tracking, and it stops
   * a stray "SELECT ..." + string in a comment or SQL-builder from counting
   * as a real vulnerability.
   */
  sinkPattern?: RegExp;
}

const JS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte']);
const PY = new Set(['.py']);
const JS_AND_PY = new Set([...JS, ...PY]);

export const PATTERN_RULES: PatternRule[] = [
  {
    id: 'eval-dynamic',
    title: 'eval() called on a dynamic value',
    severity: 'high',
    confidence: 'likely',
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
    confidence: 'likely',
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
    confidence: 'likely',
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
    regex: /(["'])\s*(?:SELECT\b[^`"\x27]*?\bFROM|INSERT\s+INTO|UPDATE\b[^`"\x27]*?\bSET|DELETE\s+FROM)\b[^"']*\1\s*\+/i,
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
    regex: /`[^`]*\b(?:SELECT\b[^`"\x27]*?\bFROM|INSERT\s+INTO|UPDATE\b[^`"\x27]*?\bSET|DELETE\s+FROM)\b[^`]*\$\{/i,
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
    regex: /f["'][^"']*\b(?:SELECT\b[^`"\x27]*?\bFROM|INSERT\s+INTO|UPDATE\b[^`"\x27]*?\bSET|DELETE\s+FROM)\b[^"']*\{/i,
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
    regex: /["'][^"']*\b(?:SELECT\b[^`"\x27]*?\bFROM|INSERT\s+INTO|UPDATE\b[^`"\x27]*?\bSET|DELETE\s+FROM)\b[^"']*["']\s*(?:%\s*\(|\.format\s*\()/i,
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
    confidence: 'likely',
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
    confidence: 'likely',
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
    confidence: 'likely',
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
    confidence: 'likely',
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

  // ─────────────── the classic vibe-coder leak: secrets in the browser ───────────────
  {
    id: 'public-env-secret',
    title: 'A secret is exposed to the browser via a public env var',
    severity: 'high',
    confidence: 'likely',
    // A build-time-public prefix (NEXT_PUBLIC_, VITE_, REACT_APP_, EXPO_PUBLIC_,
    // PUBLIC_) on a variable whose name says "secret". Anything with these
    // prefixes is inlined into the JavaScript shipped to every visitor. The
    // trailing [A-Z0-9_]* lets the match run to the true end of the name so
    // "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY" is caught, not just the prefix.
    regex:
      /\b(?:NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_|PUBLIC_|GATSBY_|VUE_APP_)[A-Z0-9_]*(?:SERVICE_ROLE|SECRET|PRIVATE|PASSWORD|API_?KEY|APIKEY|ACCESS_?KEY|TOKEN)[A-Z0-9_]*\b/,
    extensions: new Set([...JS, '.json', '.env', '']),
    explanation:
      'Environment variables with a public prefix (NEXT_PUBLIC_, VITE_, ' +
      'REACT_APP_ …) are baked into the JavaScript bundle your app sends to ' +
      'every visitor — they are NOT secret. This one is named like a real ' +
      'secret (service role, API key, password). If it holds a real ' +
      'credential, anyone can open DevTools and read it. This exact mistake ' +
      '(a service_role key shipped as NEXT_PUBLIC_) is how several vibe-coded ' +
      'apps leaked their entire database.',
    recommendation:
      'Move this to a server-only variable WITHOUT the public prefix (e.g. ' +
      'SUPABASE_SERVICE_ROLE_KEY, read only in server code / route handlers), ' +
      'rotate the credential, and make sure the browser never receives it. ' +
      'Only truly-public values (like a Supabase anon key) belong behind a ' +
      'public prefix.',
  },
  {
    id: 'react-dangerous-html',
    title: 'Untrusted HTML injected with dangerouslySetInnerHTML',
    severity: 'high',
    confidence: 'likely',
    // Flags dangerouslySetInnerHTML fed a variable/expression, not a constant.
    // The lookahead must sit BEFORE the whitespace: with `\s*(?!["'`])` the
    // engine backtracks `\s*` to zero width, the lookahead then inspects the
    // space instead of the quote, and every constant string fires.
    // The backtick exclusion forbids `$` inside, so an interpolated template
    // (`${userBio}`) still fires while a fixed one does not.
    regex: /dangerouslySetInnerHTML\s*=\s*\{\{\s*__html:(?!\s*["'][^"']*["']\s*\}\})(?!\s*`[^`$]*`\s*\}\})/,
    extensions: JS,
    explanation:
      'dangerouslySetInnerHTML renders raw HTML without React’s protection. ' +
      'When the HTML comes from a variable — user input, an API response, ' +
      'markdown — an attacker can slip in a <script> or an onerror handler ' +
      'and run code in your users’ browsers (cross-site scripting), stealing ' +
      'sessions and data.',
    recommendation:
      'Render text as text (just {value}) so React escapes it. If you must ' +
      'render HTML, sanitize it first with a library like DOMPurify: ' +
      'dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value) }}.',
  },
  {
    id: 'dom-innerhtml-assign',
    title: 'HTML built and assigned to innerHTML',
    severity: 'medium',
    confidence: 'heuristic',
    // .innerHTML = <not a plain string literal> — template/concat/variable.
    regex: /\.innerHTML\s*=\s*(?!["'`]\s*[;<])/,
    extensions: JS,
    explanation:
      'Assigning to .innerHTML with anything other than a fixed string can ' +
      'introduce cross-site scripting: if any part of the value comes from a ' +
      'user or an API, embedded markup runs as code in the browser.',
    recommendation:
      'Use textContent for text, or build elements with createElement. If you ' +
      'genuinely need HTML, sanitize it (DOMPurify) before assigning.',
  },
  {
    id: 'node-command-injection',
    title: 'Shell command built from a variable (command injection risk)',
    severity: 'high',
    confidence: 'likely',
    // child_process exec/execSync/spawn given a template literal or concat,
    // i.e. not a single quoted string literal argument.
    regex:
      /\b(?:exec|execSync|spawn|spawnSync|execFile)\s*\(\s*(?:`[^`]*\$\{|["'][^"']*["']\s*\+|\w+\s*\+|`[^`]*`\s*\+)/,
    extensions: JS,
    explanation:
      'A shell command is being assembled from a variable or template string ' +
      'and handed to child_process. If any piece comes from user input, an ' +
      'attacker can append their own command (e.g. "; rm -rf /") and run it ' +
      'on your server — full command injection.',
    recommendation:
      'Never build shell strings from input. Use execFile/spawn with the ' +
      'command and an ARRAY of arguments (execFile("git", ["clone", url])), ' +
      'so arguments can never be reinterpreted as shell syntax.',
  },
];
