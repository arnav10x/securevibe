# SecureVibe — Approved Build Plan (2026-07-14)

A web app where indie developers who built apps with AI coding tools submit a
codebase (public GitHub URL or .zip upload) and get a plain-English security
report before launch.

## The four checks (v1 scope — fixed)
1. **Hardcoded secrets** — API keys, tokens, AWS keys, database URLs,
   high-entropy credential assignments, committed .env files.
2. **Supabase/Firebase misconfiguration** — wide-open Firebase rules
   (`allow read, write: if true`, `".read": true`), disabled/missing/
   overly-permissive Row Level Security in SQL migrations.
3. **Dependency risk** — every package in package.json / requirements.txt is
   verified against the real npm/PyPI registry. Nonexistent names are flagged
   (AI-hallucinated packages, aka "slopsquatting"), plus very new or
   low-download packages.
4. **Insecure code patterns** — eval/exec on dynamic input, string-built SQL,
   disabled TLS verification, browser-storage auth state, hardcoded password
   comparisons.

## Stack
- Next.js (App Router, TypeScript, Tailwind) on Vercel
- Supabase: Postgres + Auth + transient Storage (project: pftlfrecrvnptdmjoaxq)
- Stripe hosted Checkout + Customer Portal + one webhook
- Scanner: pure TypeScript library in `lib/scanner` — no binaries, no code
  execution, unit-tested against fixtures

## The privacy guarantee (core product promise)
Submitted code is processed in an ephemeral temp directory and permanently
deleted immediately after the scan — enforced by:
1. All source lives only in the serverless function's ephemeral /tmp
2. Explicit cleanup in a `finally` block (success AND failure paths)
3. Uploaded zips deleted from storage the moment the scan ends + daily sweep
4. The database schema has nowhere to put file contents — findings hold only
   path, line number, and a single masked evidence line
5. Submitted code is never executed and never sent to any AI model
6. Each scan records `source_deleted_at`, shown on the report

## Business model
Free: 3 scans/month. Pro: $9/month unlimited (Stripe hosted Checkout).
Rate limit: 5 scan starts/hour/user regardless of plan.

## Approved decisions
- Build on Vercel Hobby; upgrade to Pro ($20/mo) at first paying customer
  (Hobby tier is non-commercial)
- Email+password auth with verification & reset (Supabase Auth)
- Findings store one masked evidence line, never raw source
- Caps: 50MB archive, 5,000 files, 1MB/file, 5-minute scan budget
- Legal pages are drafts — lawyer review before charging real customers
- Scans require an account, including free tier
