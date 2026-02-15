# Checkpoint (2026-02-07)

## Durum Ozeti
- Yeni urun ozelligi eklenmedi.
- Calisma odağı teknik saglamlastirma, veri modeli sertlestirme, hata gorunurlugu ve temizlik.
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
- Bazı localStorage parse ve fallback akislari sertlestirildi.
- Kullaniciya gorunur sistem bildirimleri eklendi.

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

## Bundan Sonra Calisma Kurali
1. Her turda tek paket veya alt-paket.
2. Her paket sonunda:
- Degisen dosyalar
- Kisa etki ozeti
- `lint` / `build` sonucu
3. Paketler arasi gecis oncesi kisa onay.
