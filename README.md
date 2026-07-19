# 🛡️ SecureVibe

A pre-launch security checkup for apps built with AI coding tools (Lovable, Bolt,
Cursor, Replit, v0, …). Paste a public GitHub repo URL or upload a .zip and get a
plain-English report of the most common security problems — with the guarantee
that your source code is **permanently deleted the moment the scan finishes**.

## What it checks

1. **Hardcoded secrets** — API keys, tokens, database passwords, committed .env files
2. **Supabase/Firebase misconfiguration** — missing/disabled Row Level Security, wide-open Firebase rules
3. **Dependency risk** — packages that don't exist on npm/PyPI (AI-hallucinated names, "slopsquatting"), plus very new / low-download packages
4. **Insecure code patterns** — eval() on input, string-built SQL, disabled TLS verification, browser-storage auth

## Stack

- **Next.js** (App Router) — one codebase for site, app, and API. Hosted on **Vercel**.
- **Supabase** — Postgres (with Row Level Security), auth, and transient zip storage.
- **Stripe** — hosted Checkout + Customer Portal; card data never touches this app.
- **Scanner** — pure TypeScript library in `lib/scanner/`. No binaries, never executes scanned code, fully unit-tested.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in values (see table below)
npm run dev                  # http://localhost:3000
npm test                     # run the test suite (incl. the deletion-guarantee tests)
```

## Environment variables

| Variable | Required for | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | everything | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | everything | Same page → "publishable" key (`sb_publishable_…`). Safe to expose; RLS protects the data. |
| `SUPABASE_SECRET_KEY` | billing, cron, package cache, instant scans | Project Settings → API keys → create a **secret** key (`sb_secret_…`). Server-only — never expose. Signed-in scanning works without it; Stripe webhook/checkout, the cleanup cron, and the landing-page instant scan (anonymous teaser reports) do not. |
| `NEXT_PUBLIC_APP_URL` | correct links/redirects | `http://localhost:3000` locally; your production URL after deploying (e.g. `https://securevibe.vercel.app`) |
| `STRIPE_SECRET_KEY` | billing | [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API keys → Secret key. **Use test mode** (`sk_test_…`) until you're ready to charge for real. |
| `STRIPE_PRICE_ID` | billing | Stripe → Product catalog → add product "SecureVibe Pro", recurring $9/month → copy the price ID (`price_…`) |
| `STRIPE_WEBHOOK_SECRET` | billing | Stripe → Developers → Webhooks → Add endpoint `https://YOUR-DOMAIN/api/stripe/webhook`, subscribe to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` → copy the signing secret (`whsec_…`). Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`. |
| `GITHUB_TOKEN` | optional | github.com → Settings → Developer settings → Fine-grained token with **no permissions**. Only raises the GitHub API rate limit (60/hr → 5,000/hr) for repo lookups. |
| `CRON_SECRET` | cleanup cron | Any long random string. Set the same value in Vercel so Vercel Cron can call `/api/cron/cleanup`. |

## Deploying to Vercel

1. Push this repo to GitHub.
2. [vercel.com](https://vercel.com) → New Project → import the repo (defaults are fine).
3. Add all environment variables above (Project → Settings → Environment Variables), with `NEXT_PUBLIC_APP_URL` set to the production URL.
4. In Supabase: Authentication → URL Configuration → set **Site URL** to the production URL and add `https://YOUR-DOMAIN/auth/callback` to Redirect URLs.
5. In Stripe: create the webhook endpoint against the production URL (table above).
6. `vercel.json` already schedules the cleanup cron daily at 03:00 UTC.

> **⚠️ Two things before charging real money**
> 1. Vercel's **Hobby tier is non-commercial**. Free beta = fine. The day you flip Stripe to live mode, upgrade to Vercel Pro ($20/mo).
> 2. Supabase's **built-in email only delivers to your own team's addresses** and is heavily rate-limited. Before real users sign up, connect a free [Resend](https://resend.com) account as custom SMTP (Supabase Dashboard → Authentication → Emails → SMTP settings) — takes ~10 minutes.

## How the deletion guarantee works

1. Submitted code only ever exists in an isolated temp workspace (`lib/scanner/acquire/workspace.ts`); on Vercel that's the function's ephemeral `/tmp`, wiped by the platform itself.
2. The workspace is deleted in a `finally` block — success, failure, or crash.
3. Uploaded zips are deleted from storage the moment the scan ends (`lib/pipeline.ts`), with a daily cron sweeping anything orphaned by a crash.
4. The database schema has no column that could hold file contents; findings store only path, line number, and one **masked** evidence line.
5. Scanned code is never executed and never sent to any AI model.
6. Tests prove it: `tests/scanner/deletion-guarantee.test.ts` and `tests/app/pipeline.test.ts` assert the source is gone (on success AND failure) before findings are persisted.

## Legal pages

`/privacy`, `/terms`, `/refunds`, `/security` are solid self-serve drafts tailored to
what the app actually does. **Have a lawyer review them before charging real
customers**, and replace the `@securevibe.app` contact emails with addresses you
actually control.

## Project layout

```
app/                 pages & API routes (marketing site, auth, app, Stripe, cron)
lib/scanner/         the scanner library — checks, rules, safe acquisition
lib/pipeline.ts      acquire → scan → delete source → persist findings
lib/quota.ts         free-tier quota + rate limit rules
supabase/migrations/ database schema + Row Level Security policies
tests/               vitest suite + vulnerable/clean fixture apps
```
