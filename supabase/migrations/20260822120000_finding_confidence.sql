-- Confidence tier on every finding: 'verified' (a fact — CVE match, decoded
-- service_role JWT, unmistakable key format, registry 404), 'likely' (a strong
-- pattern reaching a real sink), or 'heuristic' (a regex guess). Drives the
-- grade: only verified findings can force a failing security grade, and the
-- report surfaces the tier so a founder can tell a proven leak from a hunch.

alter table public.findings
  add column if not exists confidence text not null default 'heuristic'
    check (confidence in ('verified', 'likely', 'heuristic'));
