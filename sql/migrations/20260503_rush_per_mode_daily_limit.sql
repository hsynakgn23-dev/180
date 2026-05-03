-- Rush modlarını (rush_15 / rush_30) ayrı günlük limitlerle takip etmek için
-- per-mode sayım fonksiyonu. Mevcut get_daily_rush_count fonksiyonu tüm
-- modları topluca sayıyor; bu fonksiyon belirli bir modu filtreler.

create or replace function public.get_daily_rush_count_by_mode(
  p_user_id uuid,
  p_mode    text,
  p_date    date default current_date
)
returns integer
language sql
stable
security definer
as $$
  select count(*)::integer
  from public.quiz_rush_sessions
  where user_id   = p_user_id
    and mode      = p_mode
    and created_at >= (p_date::timestamp at time zone 'Europe/Istanbul')
    and created_at <  ((p_date + interval '1 day')::timestamp at time zone 'Europe/Istanbul');
$$;

grant execute on function public.get_daily_rush_count_by_mode(uuid, text, date)
  to authenticated, service_role;
