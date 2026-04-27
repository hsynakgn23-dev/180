-- ============================================================
-- Quiz Havuz Sistemi Saglik Kontrolu
-- ============================================================
-- Amac: "Quiz acilamadi" ve "Cevap gonderilemedi" hatalarinin
-- veri bazli kaynaklarini tespit etmek.
--
-- Kullanim: Supabase SQL Editor'de tek tek calistir; her sorgunun
-- sonucunu inceleyip bana gonder.
-- ============================================================


-- [1] Toplam durum: kac film, kac soru var?
select
  (select count(*) from public.question_pool_movies) as toplam_film,
  (select count(*) from public.question_pool_questions) as toplam_soru,
  (select count(*) from public.movie_pool_answers) as toplam_cevap;


-- [2] question_pool_movies.question_count tablolar arasi uyumsuz mu?
-- Film tablosu X soru var diyor ama sorular tablosunda farkli sayida olabilir.
-- "question_count" kolonu varsa:
select
  m.id,
  m.title,
  m.question_count as tabloda_yazan,
  count(q.id) as gercekte_kac,
  case when m.question_count = count(q.id) then 'OK' else 'DESYNC' end as durum
from public.question_pool_movies m
left join public.question_pool_questions q on q.movie_id = m.id
group by m.id, m.title, m.question_count
having m.question_count is distinct from count(q.id)
order by m.title;


-- [3] 5'ten az sorusu olan filmler (quiz acilamaz)
select m.id, m.title, count(q.id) as soru_sayisi
from public.question_pool_movies m
left join public.question_pool_questions q on q.movie_id = m.id
group by m.id, m.title
having count(q.id) < 5
order by soru_sayisi asc, m.title;


-- [4] EKSIK TR CEVIRISI (kullanici TR kullandigi icin kritik)
select
  q.id,
  q.movie_id,
  m.title as film,
  q.question_order,
  q.question_translations->>'tr' as tr_metin,
  q.question_translations->>'en' as en_metin,
  case
    when (q.question_translations->>'tr') is null and (q.question_translations->>'en') is null then 'HER_IKISI_BOS'
    when (q.question_translations->>'tr') is null then 'TR_EKSIK'
    else 'OK'
  end as durum
from public.question_pool_questions q
join public.question_pool_movies m on m.id = q.movie_id
where
  coalesce(trim(q.question_translations->>'tr'), '') = ''
order by m.title, q.question_order
limit 50;


-- [5] EKSIK SIKLAR (a/b/c/d'den biri icin TR veya EN yok)
select
  q.id,
  m.title as film,
  q.question_order,
  case when coalesce(trim(q.options_translations->'a'->>'tr'), '') = '' and coalesce(trim(q.options_translations->'a'->>'en'), '') = '' then 'a_BOS' end,
  case when coalesce(trim(q.options_translations->'b'->>'tr'), '') = '' and coalesce(trim(q.options_translations->'b'->>'en'), '') = '' then 'b_BOS' end,
  case when coalesce(trim(q.options_translations->'c'->>'tr'), '') = '' and coalesce(trim(q.options_translations->'c'->>'en'), '') = '' then 'c_BOS' end,
  case when coalesce(trim(q.options_translations->'d'->>'tr'), '') = '' and coalesce(trim(q.options_translations->'d'->>'en'), '') = '' then 'd_BOS' end
from public.question_pool_questions q
join public.question_pool_movies m on m.id = q.movie_id
where
  coalesce(trim(q.options_translations->'a'->>'tr'), '') = '' and coalesce(trim(q.options_translations->'a'->>'en'), '') = ''
  or coalesce(trim(q.options_translations->'b'->>'tr'), '') = '' and coalesce(trim(q.options_translations->'b'->>'en'), '') = ''
  or coalesce(trim(q.options_translations->'c'->>'tr'), '') = '' and coalesce(trim(q.options_translations->'c'->>'en'), '') = ''
  or coalesce(trim(q.options_translations->'d'->>'tr'), '') = '' and coalesce(trim(q.options_translations->'d'->>'en'), '') = ''
order by m.title, q.question_order
limit 50;


-- [6] GECERSIZ correct_option (a/b/c/d disinda)
select q.id, m.title, q.question_order, q.correct_option
from public.question_pool_questions q
join public.question_pool_movies m on m.id = q.movie_id
where q.correct_option is null
   or lower(trim(q.correct_option)) not in ('a', 'b', 'c', 'd');


-- [7] Ayni film icin ayni question_order'da mukerrer soru var mi?
select movie_id, question_order, count(*) as adet
from public.question_pool_questions
group by movie_id, question_order
having count(*) > 1;


-- [8] movie_pool_user_progress'te, cevap sayisi > toplam soru sayisi olan kullanicilar
-- (progress tablosu bozulmus mu kontrolu)
select
  p.user_id,
  p.movie_id,
  m.title,
  p.questions_answered as progress_sayisi,
  (select count(*) from public.question_pool_questions where movie_id = p.movie_id) as gercek_soru_sayisi
from public.movie_pool_user_progress p
left join public.question_pool_movies m on m.id = p.movie_id
where p.questions_answered > (
  select greatest(count(*), 5) from public.question_pool_questions where movie_id = p.movie_id
)
limit 20;


-- [9] RPC fonksiyonu gercekten var mi ve imzasi dogru mu?
select
  n.nspname as schema,
  p.proname as fonksiyon,
  pg_get_function_identity_arguments(p.oid) as parametreler
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'record_pool_answer';


-- [10] movie_pool_answers tablosundaki son 10 kayit (hata oluyor mu sistem calisir mi)
select id, user_id, question_id, is_correct, answered_at
from public.movie_pool_answers
order by answered_at desc
limit 10;
