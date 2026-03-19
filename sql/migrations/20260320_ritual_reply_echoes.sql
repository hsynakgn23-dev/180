-- Reply echoes: users can echo (like) individual ritual replies.

create table if not exists public.ritual_reply_echoes (
  reply_id uuid not null references public.ritual_replies(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (reply_id, user_id)
);

create index if not exists ritual_reply_echoes_reply_id_idx
  on public.ritual_reply_echoes (reply_id);

alter table public.ritual_reply_echoes enable row level security;

drop policy if exists "Public Ritual Reply Echoes Read"           on public.ritual_reply_echoes;
drop policy if exists "Authenticated Ritual Reply Echoes Insert"  on public.ritual_reply_echoes;
drop policy if exists "Authenticated Ritual Reply Echoes Delete"  on public.ritual_reply_echoes;

create policy "Public Ritual Reply Echoes Read"
on public.ritual_reply_echoes for select
using (true);

create policy "Authenticated Ritual Reply Echoes Insert"
on public.ritual_reply_echoes for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Authenticated Ritual Reply Echoes Delete"
on public.ritual_reply_echoes for delete
to authenticated
using (auth.uid() = user_id);
