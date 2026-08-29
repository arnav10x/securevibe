-- The rule that produced each finding. The report UI groups findings into
-- craft layers (tokens, states, typography...) by rule id, and per-signal
-- inside a layer. Older rows stay null and fall back to title matching.
alter table public.findings
  add column if not exists rule_id text;
