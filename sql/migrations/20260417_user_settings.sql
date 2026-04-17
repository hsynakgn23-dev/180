create table if not exists public.user_settings (
    user_id uuid primary key references auth.users (id) on delete cascade,
    language text not null default 'en' check (language in ('en', 'tr', 'es', 'fr')),
    theme_mode text not null default 'midnight' check (theme_mode in ('midnight', 'dawn')),
    updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.touch_user_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists touch_user_settings_updated_at on public.user_settings;

create trigger touch_user_settings_updated_at
before update on public.user_settings
for each row
execute function public.touch_user_settings_updated_at();

alter table public.user_settings enable row level security;

grant select, insert, update on public.user_settings to authenticated;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
on public.user_settings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
on public.user_settings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
on public.user_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
