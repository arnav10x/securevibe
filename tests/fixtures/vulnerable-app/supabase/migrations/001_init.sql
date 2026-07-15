-- Fixture: Supabase migration with RLS problems.
create table public.todos (
  id serial primary key,
  user_id uuid,
  body text
);

alter table public.todos disable row level security;

create policy "open access" on public.todos for all using (true);
