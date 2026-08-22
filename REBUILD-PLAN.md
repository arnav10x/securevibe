# SecureVibe — Accuracy Rebuild Plan

*Written 2026-08-22 after a hostile teardown of the scanner + market/technical/competitive
research. Companion to PLAN.md (which is the original v1 scope). This document is the plan
to fix the "hardcoded, inaccurate scores" problem and turn the product into something that
survives contact with the real world.*

## STATUS (2026-08-22) — implemented in this pass

- **Phase 0 (grading rewrite): DONE.** Security and Craft are separate grades; SSL-Labs-style
  hard caps (verified critical → F, verified high → C); diminishing returns; heuristic-noise
  floor at B-; "insufficient signal" state instead of a free A+. `lib/scanner/grade.ts`.
- **Phase 1 (confidence + false positives): DONE.** `confidence` on every finding
  (verified/likely/heuristic) driving the caps; git-aware `.env` (github = committed/critical,
  zip = warning, git-ignored = low); test-path findings don't cap; `.securevibe-ignore`
  suppression; `投资人` artifact fixed.
- **Phase 2 (detection): MOSTLY DONE.** OSV.dev CVE checks (lockfile-exact = verified, range
  floor = likely) with package-lock.json parsing; `NEXT_PUBLIC_`/`VITE_` client-bundle secret
  rule; `dangerouslySetInnerHTML`/`innerHTML` XSS; `child_process` command injection;
  sink-aware confidence bump. *Deferred:* the full AST tier (kept as sharpened regex + sink
  awareness for now — a heavy parser dependency wasn't worth half-building), Gitleaks corpus
  port, yarn/pnpm lockfile parsing.
- **Phase 4 (partial): DONE.** Per-finding "fix prompt" for Cursor/Lovable/Claude in the report.
- **DB:** migration `20260822120000_finding_confidence.sql` written; NOT yet applied (the
  Supabase project is paused — apply on next resume/deploy before running real scans).
- **Tests:** 119 passing (14 new accuracy tests); tsc + eslint clean; report card verified in
  the browser via `/dev/report-preview`.

**Still open:** Phase 3 (live-URL runtime probe — the wedge; needs the ownership/consent/SSRF
design decided first), Phase 4 rescan delta + shareable badge, and the AST tier.

---

---

## The one-sentence diagnosis

The scores feel fake because the scanner is a **regex opinion engine with no ground truth**:
it grades with linear point-subtraction (no severity caps), dilutes the security grade 50/50
with subjective design opinions, and has no verifiable data source — so it simultaneously
**misses the vulnerabilities that actually kill vibe-coded apps** (known CVEs, secrets bundled
into the client, missing RLS on the live app) **and cries wolf** on things it can't prove
(a git-ignored `.env`, a `SELECT`+`+` in a comment).

The fix is to make every number **earned and defensible**: ground findings in verifiable data
(OSV CVEs, JWT decode, live-URL probe), tier findings by confidence, separate Security from
Craft, and grade with hard caps like SSL Labs — not linear subtraction.

---

## Phase 0 — Make the existing scores real (grading model rewrite)

*No new data sources. Pure rework of `lib/scanner/grade.ts` + `report-card.tsx`. This alone
kills the "hardcoded inaccurate" feeling. Highest priority.*

**Problems being fixed (all verified in code):**
- `securityScore = 100 − 22·crit − 12·high − 4·med − 1·low`, floored at 0. Two criticals
  (committed `.env` + service_role key = total game-over) → security 56 → after 50/50 blend
  with design → **C+**. Meanwhile an empty static repo scores **A+ 100** for having no findings.
- Overall grade = `0.5·security + 0.5·design`. A *security* tool leads with a headline that is
  half font-and-color opinions (`report-card.tsx` shows `report.grade` as "Repo grade").
- 100 low-severity dependency lows (−1 each) can zero the score → **F from noise**.

**Do this:**
1. **Split into two independent grades, never blended.** `Security` (A–F) is the headline.
   `Craft` / vibe meter is a separate, clearly-secondary score. Kill the 50/50 `overall`.
2. **Adopt SSL-Labs / SonarQube-style hard caps** (see `docs` refs below). Compute a weighted
   hygiene score, then override with a ceiling based on the worst *verified* finding:
   - any Verified **critical** → grade capped at **F** (or D-, tunable)
   - any Verified **high** → capped at **C**
   - unverified/heuristic findings **cannot** cap below **B** (they can only shave points)
3. **Diminishing returns per category.** Dependency-hygiene lows cap at, e.g., −10 total, not
   −1×N. One noisy rule must never dominate.
4. **Zero findings ≠ A+.** Show what actually ran: "18 checks run · 15 passed · 3 not
   applicable · **here's what we can't see from source alone**" (Mozilla-Observatory honesty).
   An empty repo should read "nothing to grade," not "perfect."
5. **Show *why* the grade is capped.** "Your grade is capped at F because a live Stripe key is
   committed" is more actionable and more shareable than "you lost 37 points."

**Acceptance:** the two worked examples above produce intuitively-correct grades (game-over repo
→ F; empty repo → "insufficient signal", not A+). Add unit tests in `tests/app/` pinning them.

---

## Phase 1 — Confidence tiers + kill the false positives

*The credibility layer. A single wrong "CRITICAL" to a nervous non-technical founder burns all
trust. Verified in code: these FPs exist today.*

1. **Three confidence tiers on every finding**, surfaced in the UI and driving the caps above:
   - **Verified** — OSV CVE match, decoded service_role JWT, live-probe confirmed, package
     doesn't exist on registry. These are *facts*. Only these can cap the grade.
   - **Likely** — AST-confirmed pattern reaching a real sink (Phase 2).
   - **Heuristic** — regex-only guess. Shown, but labelled, and can't tank a grade.
2. **Fix the `.env` false positive.** Today `.git` is skipped during the walk
   (`limits.ts:37`), so the scanner *cannot* know what git tracks, yet `checks/secrets.ts`
   asserts a committed `.env` is "committed to the repository." For a **zip upload there is no
   git at all** — the claim is unprovable. Fix: read `.gitignore` (and `.git` if present) and
   only say "committed" when it's actually tracked; otherwise "present in the upload —
   make sure it's git-ignored." Downgrade confidence accordingly.
3. **Exclude test/fixture files from security dents** (design.ts already excludes them; security
   checks do not). A planted secret in `tests/` shouldn't tank the security grade — flag it
   separately as "test-only" and don't let it cap.
4. **Add a suppression mechanism** — a `.securevibe-ignore` file and/or per-finding "dismiss"
   in the UI, persisted, so rescans stop re-nagging intentional choices (e.g. a deliberately
   public table). Without this, retention dies on repeat scans.
5. **Fix the `投资人` artifact** in `checks/design.ts:768` — a Chinese-character AI-generation
   tell literally inside the tool that grades AI-generation tells. One-line edit; do it before
   anyone reads the repo. (Also self-scan the repo in CI: the product must pass its own audit.)

---

## Phase 2 — Detection accuracy: the missing killers

*What the scanner cannot currently catch — confirmed absent via grep. These are the exact
classes behind every documented breach (see research refs).*

1. **Dependency CVEs via OSV.dev** — *the single biggest accuracy win.* Free, no auth, npm+PyPI.
   `POST https://api.osv.dev/v1/querybatch`. For no-lockfile `package.json` ranges: resolve
   `^1.2.0` → concrete max-satisfying version via `registry.npmjs.org/<pkg>`, then send exact
   versions to OSV. Today the "dependency risk" check only tests existence/age/downloads — it
   never asks if an installed version has a known CVE, which free `npm audit` already does.
   Also broaden manifests: `pyproject.toml`, `Pipfile`, `poetry.lock`, yarn/pnpm lockfiles.
2. **Client-bundle secret leak** — detect `NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`, `PUBLIC_`,
   `EXPO_PUBLIC_` prefixes on secret-named vars, and service_role/`sb_secret`/API keys imported
   into `"use client"` files. This is *the* classic vibe-coder leak (Moltbook: 1.5M tokens
   from `NEXT_PUBLIC_SUPABASE_ANON_KEY` + no RLS). Currently not checked at all.
3. **XSS** — `dangerouslySetInnerHTML` / `innerHTML =` with non-constant input. Not checked.
4. **Command injection** — `child_process.exec`/`execSync`/`spawn` with string concatenation.
   Not checked.
5. **Missing auth on API routes** — Next.js route handlers / server actions that do DB writes
   with no session/auth check. Hard but high-value (this is IDOR/broken-access-control, the
   #1 real-world class). Start heuristic, upgrade with AST.
6. **Cookie flags, CORS `*` (esp. with credentials), open redirect** — cheap wins.
7. **Secret corpus upgrade** — port the **MIT-licensed Gitleaks** regex corpus (~150+ provider
   patterns, legally clean for commercial SaaS with attribution) + Apache-2.0 detect-secrets
   heuristics. Keep a NOTICE file. Do **not** port Semgrep/Opengrep/AGPL rules.

**AST tier (the precision multiplier):** move injection/eval/XSS rules from line-regex to a
**pure-JS AST pass** (`@babel/parser` or the TS compiler API — zero Vercel bundling risk).
Flag a SQL string built by concatenation *only when passed to a known sink* (`db.query`,
`knex.raw`, `pool.query`), not any `"SELECT"+x`. This is what turns "Heuristic" findings into
"Likely" ones and slashes false positives. Regex stays for cheap breadth (secrets).

---

## Phase 3 — The runtime wedge (live-URL probe)

*The strategic pivot. Every documented breach — Lovable CVE-2025-48757 (170+ apps), Moltbook,
Tea, Enrichlead — was caught at **runtime on the live URL**, not in source. Source scanning is
necessary but it is not where the value or the differentiation is. Competitors already scan by
URL. This is the highest-leverage new capability.*

**Owner-submitted deployed URL → read-only probe:**
1. **Security headers** (CSP, HSTS, X-Frame-Options, cookie flags) — Mozilla Observatory set.
2. **Exposed files** — GET `/.env`, `/.git/config`, `/.git/HEAD`, source maps (`*.js.map` with
   `sourcesContent` leaking secrets). Verify body actually matches the target (SPAs 200 on
   everything).
3. **Supabase RLS test** — extract the anon key from the site's JS bundle (or owner pastes
   URL + anon key), then `GET /rest/v1/<table>?select=*&limit=1` with the anon key. Rows
   returned = RLS off = **Verified critical**. Discover table names from the app's own
   `.from('<table>')` calls + a common-name dictionary — **not** the `/rest/v1/` OpenAPI
   endpoint, which loses anon access 2026-04-08 for existing projects.
4. **Firebase** — open storage buckets / public read rules (the Tea failure).

**Ethics/safety (hard constraints):** read-only only — **no INSERT/UPDATE/DELETE probes** (a
DELETE against an RLS-off DB is the vulnerability; running it is destroying the user's data).
Verify ownership before probing. Explicit ToS consent. Self-submitted-only; never mass-scan.
"Detect presence, never exploit or exfiltrate." This also lets the report *demonstrate* the
hole ("we read a row from your `users` table as an anonymous visitor") — infinitely more
convincing than a source-code guess, and it's what makes the grade feel earned.

Reference implementation to study (verify license before porting):
`github.com/Perufitlife/supabase-security-skill`.

---

## Phase 4 — Distribution & retention (steal from the winners)

1. **Per-finding fix prompt.** The audience can't read code — their native remediation is
   pasting a prompt into Cursor/Lovable/Claude. Generate a copy-paste, platform-aware fix
   prompt per finding. This is the format every successful vibe-scanner ships and it's cheap.
2. **Rescan delta.** "You fixed 4 of 6 — 2 criticals remain." The fix→rescan loop is the
   retention engine; it doesn't exist today.
3. **Shareable report + grade badge.** securityheaders.com hit 250M scans on exactly this:
   public shareable result URL + an embeddable "Security grade: A" badge. The anon teaser at
   `/r/[id]` is a good start — extend it to a badge and let *good* grades be bragged about.
4. **GitHub App / PR check** (later) — every PR comment is seen by the team; built-in virality.

---

## Positioning (how to not die)

- **Wedge vs platform-native scanners** (Lovable's built-in scan, Lovable×Aikido $100 pentest):
  be **cross-platform** (one scanner for Lovable + Bolt + v0 + Cursor + Claude Code apps) and
  **test exploitability, not presence**. Lovable's own initial scan only checked that an RLS
  policy *existed*, not that it *worked* — that credibility gap is the opening.
- **Wedge vs "just ask ChatGPT/Claude"** (the free alternative): the Semgrep Sept-2025 benchmark
  put Claude Code at **14% true-positive / 86% false-positive**, non-deterministic across runs,
  and *worse* when the user frames the code as probably-fine (arXiv framing-bias: 97%→4%). Lead
  with: deterministic, verifiable, and it doesn't ask the same AI that wrote the bug to grade it.
- **Lean on the privacy guarantee** (delete-before-persist, masked evidence, code never sent to
  an AI, `source_deleted_at` shown). It's genuinely strong and it's the direct counter to
  "paste your proprietary code into a chatbot." Currently under-exploited in messaging.
- **Pricing:** the $9/mo / 3-free-scans band is validated (competitors at $5–$29). Consider a
  one-time "$9 full report" option — the vibe-tool audience buys reports, not dev seats.

---

## Suggested build order (by leverage ÷ effort)

1. **Phase 0** grading rewrite + **Phase 1.2** `.env` FP fix + **1.5** `投资人` — days, huge
   credibility gain, no new infra. *This is the direct answer to "hardcoded inaccurate scores."*
2. **Phase 2.1** OSV CVE check — the biggest accuracy jump, free API.
3. **Phase 2.2** client-bundle secret leak + **1.1** confidence tiers.
4. **Phase 3** live-URL Supabase RLS probe — the wedge; makes the product genuinely valuable.
5. **Phase 2** AST tier, **Phase 4** fix-prompts + delta + badge.

## Key references
- Grading caps: SSL Labs Rating Guide (`github.com/ssllabs/research/wiki/SSL-Server-Rating-Guide`);
  Mozilla HTTP Observatory scoring (`developer.mozilla.org/en-US/observatory/docs/tests_and_scoring`);
  SonarQube security rating A–E (worst-finding capping).
- Free vuln data: OSV.dev (`google.github.io/osv.dev/post-v1-querybatch/`); deps.dev.
- Portable corpora: Gitleaks (MIT), detect-secrets (Apache-2.0). Avoid Semgrep/AGPL rules.
- Breaches: CVE-2025-48757 (Lovable RLS, 170+ apps); Wiz on Moltbook; SymbioticSec 1,072-app
  study (98% flawed); Semgrep LLM-review benchmark (14% TPR).
- Runtime probe ethics + technique: SymbioticSec method; `Perufitlife/supabase-security-skill`.
