-- Instant scans from the landing page: the scan row can exist before any
-- account does. user_id becomes nullable; anonymous rows carry a hashed IP
-- (rate limiting) and a claim token so the account created in the same
-- browser can adopt the scan. Existing RLS policies compare user_id to
-- auth.uid(), which is never true for NULL user_id — so anonymous rows are
-- invisible to signed-in users and are handled only by the server
-- (service role) until claimed.

alter table public.scans alter column user_id drop not null;
alter table public.scans add column anon_ip_hash text;
alter table public.scans add column claim_token uuid;

create index scans_anon_ip_idx
  on public.scans (anon_ip_hash, created_at desc)
  where anon_ip_hash is not null;
