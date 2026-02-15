# Checkpoint (2026-02-07)

## Durum Ozeti
- Yeni urun ozelligi eklenmedi.
- Calisma odagi teknik saglamlastirma, veri modeli sertlestirme, hata gorunurlugu ve temizlik.
- Kod tabani su an `lint` ve `build` geciyor.

## Ne Yaptik (Feature Degil)
1. Supabase sosyal model gecisi:
- `rituals` icindeki gomulu sosyal alanlardan (`echoes`, `is_echoed_by_me`, `replies`) iliskisel modele gecis.
- Yeni tablolar: `ritual_echoes`, `ritual_replies`.
- RLS kurallari ve indeksler sertlestirildi.
2. Auth / profil sync ve feed akisi:
- Auth tabanli ownership kontrolleri.
- Arena feed fetch + realtime + hata gorunurlugu iyilestirildi.
3. Operasyonel temizlik:
- Debug panelin production bundle'a girmemesi.
- Legacy dosyalarin temizlenmesi.
- Rollout/test dokumantasyonu ve migration SQL eklenmesi.
- Growth ve mobil uygulama plani eklendi (`docs/GROWTH_AND_MOBILE_PLAN_2026Q1.md`).
4. Dayaniklilik:
- Bazi localStorage parse ve fallback akislari sertlestirildi.
- Kullaniciya gorunur sistem bildirimleri eklendi.
5. Referral hardening (package 3.1):
- Davet akisi API-first modele tasindi (lokal fallback sadece API ulasilamazsa).
- `api/referral/create` ve `api/referral/claim` endpointleri eklendi.
- `sql/migrations/20260217_referral_hardening_rpc.sql` ile RPC + device guard eklendi.
6. Referral e2e test plani:
- `docs/TEST_PLAN_REFERRAL_3_1.md` eklendi.
- Invite create/claim, anti-abuse ve SQL dogrulama senaryolari tanimlandi.
7. Referral smoke runner:
- `test-referral-smoke.js` eklendi (create/claim/e2e modlari).
- `package.json` scriptleri ve `.env.example` test env alanlari guncellendi.
8. Growth KPI gorunurlugu:
- `sql/migrations/20260218_analytics_kpi_views.sql` ile KPI view'lari eklendi.
- `docs/KPI_DASHBOARD_2026Q1.md` ile dashboard/query runbook eklendi.

## Bu Asamada Bilerek Yapilmayanlar
- Yeni sayfa / yeni ana feature / yeni is akisi yok.
- UI kapsamli redesign yok.
- Davranis degistiren buyuk refactor yok.

## Degisiklik Paketleri (Karismamasi Icin)
1. `db-rollout`:
- `supabase_setup.sql`
- `sql/migrations/20260207_social_model_v2.sql`
- `docs/ROLLOUT_SOCIAL_MODEL.md`
- `docs/TEST_PLAN_SOCIAL_SYNC.md`
2. `arena-social-sync`:
- `src/features/arena/Arena.tsx`
- `src/features/arena/RitualCard.tsx`
- `src/context/NotificationContext.tsx`
- `src/features/notifications/NotificationCenter.tsx`
3. `auth-profile-sync`:
- `src/context/XPContext.tsx`
- `src/features/auth/LoginView.tsx`
4. `ops-hardening`:
- `src/App.tsx`
- `src/hooks/useDailyMovies.ts`
- `src/features/daily-showcase/MovieCard.tsx`
- `test-supabase-connection.js`
- `.env.example`
- `README.md`
5. `legacy-cleanup`:
- `src/features/landing/LandingPage.locked.tsx` (silindi)
- `src/features/profile/ProfileView.old.tsx` (silindi)
6. `growth-plan`:
- `docs/GROWTH_AND_MOBILE_PLAN_2026Q1.md`
7. `referral-hardening-3.1`:
- `src/context/XPContext.tsx`
- `src/features/profile/SettingsModal.tsx`
- `src/lib/referralApi.ts`
- `api/referral/create.ts`
- `api/referral/claim.ts`
- `sql/migrations/20260217_referral_hardening_rpc.sql`
- `docs/REFERRAL_PACKAGE_3_1.md`
8. `referral-test-plan-3.1`:
- `docs/TEST_PLAN_REFERRAL_3_1.md`
9. `referral-smoke-runner`:
- `test-referral-smoke.js`
- `package.json`
- `.env.example`
- `README.md`
10. `growth-kpi-views-2026q1`:
- `sql/migrations/20260218_analytics_kpi_views.sql`
- `docs/KPI_DASHBOARD_2026Q1.md`
- `README.md`

## Bundan Sonra Calisma Kurali
1. Her turda tek paket veya alt-paket.
2. Her paket sonunda:
- Degisen dosyalar
- Kisa etki ozeti
- `lint` / `build` sonucu
3. Paketler arasi gecis oncesi kisa onay.
