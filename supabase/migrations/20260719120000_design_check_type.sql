-- The design/vibe-check scan files its findings alongside the security
-- checks, so the findings table must accept the new check type.

alter table public.findings
  drop constraint findings_check_type_check;

alter table public.findings
  add constraint findings_check_type_check
  check (check_type in ('secret', 'platform_config', 'dependency', 'insecure_pattern', 'design'));
