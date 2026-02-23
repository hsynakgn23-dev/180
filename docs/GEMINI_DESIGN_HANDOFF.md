# Gemini Design Handoff

Bu dosya teknik ekipten (Codex) tasarim ekibine (Gemini) handoff formatidir.
Kural:
- Codex sadece teknik altyapiyi yazar.
- Gemini sadece UI/visual tasarimi iyilestirir.
- Her yeni teknik isten sonra bu dosyaya yeni bir "Report" bolumu eklenir.

## Copy/Paste Command (Gemini Prompt)

Asagidaki metni Gemini'ye direkt gonder:

```text
Sen bu repoda sadece tasarim katmanindan sorumlusun.
Lutfen once docs/GEMINI_DESIGN_HANDOFF.md dosyasindaki en son "Report" bolumunu oku.
Ardindan sadece UI/UX/tasarim iyilestirmeleri yap.
Asagidaki teknik sinirlari bozma:
- Veri modeli, API contract, state shape, event isimleri degismeyecek.
- Sadece presentational katman (layout, spacing, typography, visual hierarchy, component skin) guncellenecek.
- Yeni teknik feature ekleme; mevcut teknik altyapiyi kullan.
- TypeScript ve lint hatasi birakma.
Sonunda "DESIGN CHANGELOG" basligi ile hangi ekranlarda ne degistirdigini yaz.
```

---

## Report 2026-02-21 - Mobile parity foundation (tech only)

### Scope tamamlandi (teknik)
- Gece/Gunduz mode state + persist altyapisi eklendi.
  - `apps/mobile/src/lib/mobileThemeMode.ts`
  - `apps/mobile/App.tsx`
- Profil mark verisi xp_state icinden okunur hale getirildi (`marks`, `featuredMarks`).
  - `apps/mobile/src/lib/mobileProfileStats.ts`
  - `apps/mobile/src/ui/appTypes.ts`
- Mobile profile tarafina mark listesi icin teknik data baglandi.
  - `apps/mobile/src/lib/mobileMarksCatalog.ts`
  - `apps/mobile/src/ui/appScreens.tsx`
- Daily endpoint/caching yoksa ekrani bos birakmamak icin fallback movie listesi eklendi.
  - `apps/mobile/src/lib/dailyApi.ts`
- "Tum yorumlar" icin mobile comment feed altyapisi eklendi (live + fallback).
  - `apps/mobile/src/lib/mobileCommentsFeed.ts`
  - `apps/mobile/src/ui/appTypes.ts`
  - `apps/mobile/src/ui/appScreens.tsx`
  - `apps/mobile/App.tsx`

### Teknik olarak eklendi ama tasarim olarak gecici
- Theme mode karti (islev var, visual polish gecici)
- Profile marks karti (veri var, visual hierarchy basic)
- Comment feed karti (filter/search/refresh var, visual polish basic)
- Dawn mode icin sadece token-safe gecisler (design parity guard bozulmadan)

### Gemini'den istenen tasarim isi
- `ThemeModeCard` icin daha net visual state ayrimi (active/inactive mode)
- `ProfileMarksCard` icin mark gruplama/hiyerarsi/pill sistemi
- `CommentFeedCard` icin okunabilir feed satiri, spacing, interaction affordance
- Explore/Profile tablarinda section ritmini guclendirme (header-card-content akisi)
- Tum degisikliklerde mevcut color token setini koruma (design parity check ile uyumlu)

### Degistirilmemesi gereken teknik kisimlar
- `fetchMobileCommentFeed` donus sekli
- `ProfileState` icindeki `marks` ve `featuredMarks` alanlari
- `DailyState.dataSource` (`live | cache | fallback`)
- Route/intent akislari (`screenPlan`, deep-link handling)

### Validation (gecti)
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx apps/mobile/src/ui/appStyles.ts apps/mobile/src/lib/mobileCommentsFeed.ts apps/mobile/src/lib/mobileProfileStats.ts apps/mobile/src/lib/dailyApi.ts apps/mobile/src/ui/appTypes.ts apps/mobile/src/lib/mobileThemeMode.ts apps/mobile/src/lib/mobileMarksCatalog.ts`
- `npm run test:mobile:design:parity`
- `npm run test:mobile:contracts`

---

## Report 2026-02-21 - Comment feed + marks hardening (tech only)

### Scope tamamlandi (teknik)
- Comment feed modeli sort destekleyecek sekilde genisletildi.
  - `apps/mobile/src/lib/mobileCommentsFeed.ts`
  - `CommentFeedSort` eklendi: `latest | echoes`
  - Feed item alanlari genisletildi: `userId`, `createdAtMs`
  - Live/fallback tum akislarda sort uygulanir hale getirildi.
- Comment feed UI contract ve app state sort ile senkronize edildi.
  - `apps/mobile/src/ui/appTypes.ts`
  - `apps/mobile/App.tsx`
  - `apps/mobile/src/ui/appScreens.tsx`
  - Refresh artik `scope + sort + query` ile cagriliyor.
- Yorum satirina "Profil" aksiyonu icin teknik akis eklendi.
  - `apps/mobile/App.tsx`
  - `apps/mobile/src/ui/appScreens.tsx`
  - `buildPublicProfileUrl(...)` ile web public profile acilisi baglandi.
- Mark katalogu kategori bazli hale getirildi.
  - `apps/mobile/src/lib/mobileMarksCatalog.ts`
  - `resolveMobileMarkMeta(...)`, `groupMobileMarksByCategory(...)` eklendi.
- Profile marks karti kategorili veri okuyacak sekilde guncellendi.
  - `apps/mobile/src/ui/appScreens.tsx`
  - `apps/mobile/src/ui/appStyles.ts`
- Design parity guard icin token-safe duzeltme yapildi.
  - `apps/mobile/src/ui/appStyles.ts`
  - Disallowed `#000000` shadowColor degerleri `#121212` ile degistirildi.

### Teknik olarak eklendi ama tasarim olarak gecici
- Comment feed sort chipleri (islev var, hierarchy/contrast basic)
- Comment row action alani (Profil butonu var, spacing/polish basic)
- Profile marks category bloklari (gruplama var, visual rhythm basic)

### Gemini'den istenen tasarim isi
- `CommentFeedCard` sort kontrolleri icin net active/inactive state dili
- Comment satiri icinde metin-hareket dengesi (icerik ve aksiyon ayrimi)
- `ProfileMarksCard` category header + pill spacing/hierarchy iyilestirmesi
- `Profil` aksiyonunun satir icindeki affordance'ini guclendirme
- Tum degisikliklerde yalnizca mevcut token setini kullanma (design parity uyumu)

### Degistirilmemesi gereken teknik kisimlar
- `CommentFeedSort` tipi: `latest | echoes`
- `fetchMobileCommentFeed(...)` donus seklindeki `userId` ve `createdAtMs` alanlari
- `groupMobileMarksByCategory(...)` cikis yapisi
- `handleOpenCommentAuthorProfile(...)` akisi ve analytics event isimleri

### Validation (gecti)
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx apps/mobile/src/ui/appStyles.ts apps/mobile/src/lib/mobileCommentsFeed.ts apps/mobile/src/lib/mobileMarksCatalog.ts apps/mobile/src/ui/appTypes.ts`
- `npm run test:mobile:contracts`
- `npm run test:mobile:design:parity`

---

## Report 2026-02-21 - Daily feed resilience + visibility (tech only)

### Scope tamamlandi (teknik)
- Daily API bos film listesi dondugunde akisin bos kalmasi engellendi.
  - `apps/mobile/src/lib/dailyApi.ts`
  - Live response `movies=[]` ise artik cache veya local fallback kullaniliyor.
  - Warning mesaji state'e tasiniyor: `Daily API returned empty movies payload`.
- Daily ekraninda veri yolu daha gorunur hale getirildi.
  - `apps/mobile/src/ui/appScreens.tsx`
  - Success halinde her zaman `Veri Yolu: canli | onbellek | fallback` satiri gosteriliyor.
  - Warning kutusu sadece ops modda degil, normal akista da gosteriliyor.
- Daily error durumunda teknik hata mesaji artik sadece ops modda gizli kalmiyor.
  - `apps/mobile/src/ui/appScreens.tsx`
  - Error ekraninda `state.message` kullaniciya acik sekilde yazdiriliyor.

### Teknik olarak eklendi ama tasarim olarak gecici
- `Veri Yolu` satiri su an islevsel, tipografik vurgu basic
- Warning kutusu teknik odakli, visual hierarchy/padding basit
- Error mesaj satiri okunur ama tone/spacing polish ihtiyaci var

### Gemini'den istenen tasarim isi
- `DailyHomeScreen` icinde `Veri Yolu` satirinin bilgi hiyerarsisini guclendirme
- Warning kutusunu mevcut token seti icinde daha okunur/dengeleyici hale getirme
- Error state metninin card icindeki ritmini iyilestirme (headline-body-meta akisi)
- Bu yeni metin katmanlarini mobile kart sisteminde "ops hissi" vermeden urun diline yedirme

### Degistirilmemesi gereken teknik kisimlar
- `fetchDailyMovies` icindeki `movies.length === 0` fallback karari
- `DailyState.dataSource` degerleri: `live | cache | fallback`
- `DailyState.warning` alaninin state akisi
- Daily card icindeki veri kaynagi metninin state'e bagli mantigi

### Validation (gecti)
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/src/lib/dailyApi.ts apps/mobile/src/ui/appScreens.tsx apps/mobile/src/ui/appStyles.ts`
- `npm run test:mobile:contracts`
- `npm run test:mobile:design:parity`

---

## Report 2026-02-21 - Comment feed server-side pagination (tech only)

### Scope tamamlandi (teknik)
- Comment feed API katmani server-side `page/limit` destekler hale getirildi.
  - `apps/mobile/src/lib/mobileCommentsFeed.ts`
  - Yeni opsiyonlar: `page`, `pageSize`
  - Yeni sonuc alanlari: `page`, `pageSize`, `hasMore`
  - Supabase sorgusu artik `range(offset, end)` ile sayfali cekiyor.
  - `scope=today` ve `query` icin server-side filtre uygulanir; client filtre korumasi devam eder.
- Comment feed state modeli pagination bilgisi tasir hale getirildi.
  - `apps/mobile/src/ui/appTypes.ts`
  - `CommentFeedState` alanlari: `page`, `pageSize`, `hasMore`, `isAppending`
- App akisi `replace` ve `append` modlariyla guncellendi.
  - `apps/mobile/App.tsx`
  - Ilk yukleme/yenileme `replace` modunda sayfa 1'e doner.
  - "Daha fazla yukle" `append` modunda bir sonraki sayfayi ceker.
  - Append modunda item merge dedupe (`id`) ile yapilir.
- Comment kartina teknik pagination aksiyonu baglandi.
  - `apps/mobile/src/ui/appScreens.tsx`
  - `Daha Fazla Yukle` aksiyonu ve sayfa bilgisinin gosterimi eklendi.
- Pagination UI icin minimal teknik stil eklendi.
  - `apps/mobile/src/ui/appStyles.ts`
  - `commentFeedLoadMoreButton`, `commentFeedLoadMoreText`

### Teknik olarak eklendi ama tasarim olarak gecici
- `Daha Fazla Yukle` butonu islevsel ama visual hierarchy basic
- Sayfa meta satiri teknik odakli, product copy/polish basic
- Append yukleme durumunun kart icindeki ritmi sade (polish bekliyor)

### Gemini'den istenen tasarim isi
- Comment kartinda "Yenile" ve "Daha Fazla Yukle" aksiyonlari arasinda net hiyerarsi
- Sayfa/meta bilgisini daha sakin ve okunur bir bilgi katmanina cevirme
- Append loading durumuna micro-state hissi verme (renk/spacing/weight dengesi)
- Tum degisikliklerde mevcut token setinden cikmama (design parity uyumu)

### Degistirilmemesi gereken teknik kisimlar
- `fetchMobileCommentFeed` sonucundaki `page/pageSize/hasMore` alanlari
- App tarafindaki `replace | append` akisi
- Append merge dedupe mantigi (`id` bazli)
- `CommentFeedState` icindeki pagination alanlari

### Validation (gecti)
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/lib/mobileCommentsFeed.ts apps/mobile/src/ui/appScreens.tsx apps/mobile/src/ui/appTypes.ts apps/mobile/src/ui/appStyles.ts`
- `npm run test:mobile:contracts`
- `npm run test:mobile:design:parity`

---

## Report 2026-02-21 - Intro + auth gate + guest mode (tech only)

### Scope tamamlandi (teknik)
- App acilisina adimli giris kapisi eklendi.
  - `apps/mobile/App.tsx`
  - Akis: `intro -> auth -> main`
- Intro adiminda uygulama amaci/feature kapsami teknik olarak gosterilir hale getirildi.
  - `apps/mobile/App.tsx`
- Auth adiminda hem giris hem kayit (signup) teknik akisi eklendi.
  - `apps/mobile/App.tsx`
  - `supabase.auth.signInWithPassword(...)`
  - `supabase.auth.signUp(...)`
- "Uye olmadan devam et" (guest mode) teknik akisi eklendi.
  - `apps/mobile/App.tsx`
  - Guest secildiginde main'e gecis acik; auth state guest mesajina cekiliyor.
- Etkilesim gerektiren aksiyonlara uye guard'i eklendi.
  - `apps/mobile/App.tsx`
  - `handleSubmitRitualDraft` artik uye degilse erken cikiyor.
  - `handleFlushRitualQueue` artik uye degilse erken cikiyor.
- Ust metrik/etiketlerde guest durumunun teknik ayrimi eklendi.
  - `apps/mobile/App.tsx`
  - `authSummary` artik `ready | guest | required`.

### Teknik olarak eklendi ama tasarim olarak gecici
- Intro card metin hiyerarsisi basic
- Auth gate karti (giris/kayit/misafir) layout'u islevsel ama visual polish basic
- Guest mode bilgilendirme dili teknik odakli, product tone polish bekliyor

### Gemini'den istenen tasarim isi
- Intro ekraninda mesaj hiyerarsisi + CTA vurgusu
- Auth gate ekraninda giris/kayit/misafir aksiyonlarinin net visual hiyerarsisi
- Form alanlari ve durum metinlerinin spacing/typography iyilestirmesi
- Guest mode bilgisinin daha net ama sakin urun diliyle sunulmasi
- Mevcut token setinden cikmadan intro/auth ekranlarinin gorsel parity'si

### Degistirilmemesi gereken teknik kisimlar
- `entryStage` akis mantigi: `intro -> auth -> main`
- `handleSignIn` / `handleSignUp` basari-basarisizlik state gecisleri
- `handleContinueAsGuest` ile main'e gecis ve guest state akisi
- `handleSubmitRitualDraft` ve `handleFlushRitualQueue` uye guard kontrolleri

### Validation (gecti)
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx`
- `npm run test:mobile:contracts`
- `npm run test:mobile:design:parity`

---

## Report 2026-02-21 - Profile routing hardening (tech only)

### Scope tamamlandi (teknik)
- Profil URL uretimi ve URL guvenlik dogrulamasi ayri helper'a tasindi.
  - `apps/mobile/src/lib/mobilePublicProfile.ts`
  - `buildMobilePublicProfileUrl(...)`
  - `isAllowedMobilePublicProfileUrl(...)`
- Profile gecisleri sadece canonical profile route ile sinirlandi.
  - `apps/mobile/App.tsx`
  - Arena ve comment feed profile acilislarinda URL guard aktif.
  - Sadece app web base + `#/u/...` profile hash rotasi kabul edilir.
- Name-route fallback kapatildi; profile gecis userId tabanli hale getirildi.
  - `apps/mobile/App.tsx`
  - `MOBILE_PROFILE_NAME_FALLBACK_ENABLED = false`
- Manuel profile-link bridge akisindan cikarildi.
  - `apps/mobile/App.tsx`
  - `PublicProfileBridgeCard` Explore'dan kaldirildi.
- Comment feed satirinda userId olmayan kayitlar icin profil aksiyonu kilitlendi.
  - `apps/mobile/src/ui/appScreens.tsx`
  - `apps/mobile/src/ui/appStyles.ts`

### Teknik olarak eklendi ama tasarim olarak gecici
- `Profil Kilitli` state metni islevsel ama visual affordance basic
- Disabled profile aksiyonunda spacing/contrast/basic token uygulamasi var
- Explore akisinda kaldirilan bridge alaninin ritmi tasarim polish bekliyor

### Gemini'den istenen tasarim isi
- Comment feed satirinda `Profil` vs `Profil Kilitli` durumlarini daha net ayristirma
- Disabled profile state'ini okunabilir ama sakin bir visual dilde ele alma
- Explore sekmesinde bridge card kalktiktan sonra section ritmini dengeleme
- Tum degisikliklerde mevcut token setinden cikmama (design parity uyumu)

### Degistirilmemesi gereken teknik kisimlar
- `buildMobilePublicProfileUrl(...)` uretim kurali (base + `#/u/...`)
- `isAllowedMobilePublicProfileUrl(...)` guard kurallari (origin/path/hash kontrolu)
- `MOBILE_PROFILE_NAME_FALLBACK_ENABLED = false` guvenlik davranisi
- Arena/comment profile acilislarindaki `mobile_*_profile_blocked_url` guard akisi

### Validation (gecti)
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx apps/mobile/src/ui/appStyles.ts apps/mobile/src/lib/mobilePublicProfile.ts scripts/mobile-contract-smoke.mjs`
- `npm run test:mobile:contracts`
- `npm run test:mobile:design:parity`
- `npm run mobile:phase1:release:check:ci`

---

## Report 2026-02-21 - Native public profile screen + userId enrichment (tech only)

### Scope tamamlandi (teknik)
- Kullanici profiline gecis web link yerine native ekran akisina tasindi.
  - `apps/mobile/App.tsx`
  - Comment feed ve Arena'dan profil acilisinda artik native profile view aciliyor.
- Native public profile snapshot servisi eklendi.
  - `apps/mobile/src/lib/mobilePublicProfileSnapshot.ts`
  - Hedef kullanici icin profile/xp_state + follow + ritual timeline okumasi yapiliyor.
- Social/Explore profil aksiyonlarinda `userId` yoksa acilis engeli korunurken, `userId` bulunabilirligi arttirildi.
  - `apps/mobile/src/lib/mobileAuthorUserMap.ts`
  - `apps/mobile/src/lib/mobileCommentsFeed.ts`
  - `apps/mobile/src/lib/mobileArenaSnapshot.ts`
  - Eksik `userId` alanlari author-name eslestirmesiyle tamamlanmaya calisiyor.
- Native profile detay karti eklendi.
  - `apps/mobile/src/ui/appScreens.tsx`
  - `PublicProfileDetailCard` ile metrik/marks/follow verisi gosteriliyor.
- Arena leaderboard profile butonu linke degil dogrudan `userId` varligina baglandi.
  - `apps/mobile/src/ui/appScreens.tsx`

### Teknik olarak eklendi ama tasarim olarak gecici
- Native profile ekraninin header-card ritmi temel seviyede
- `Geri Don` / `Profili Yenile` aksiyonlari islevsel ama visual hierarchy basic
- Arena ve Social icindeki profile entry affordance dili teknik odakli

### Gemini'den istenen tasarim isi
- Native profile ekraninda bilgi hiyerarsisini guclendirme (identity -> metrics -> actions)
- `Profil` aksiyonu olan satirlarla kilitli satirlarin ayrimini daha netlestirme
- `PublicProfileDetailCard` icinde metric grid ritmi ve spacing iyilestirmesi
- Social ve Explore ekranlarinda profile gecis CTA'larinin gorsel tutarliligini arttirma
- Tum degisikliklerde mevcut token setini koruma (design parity uyumu)

### Degistirilmemesi gereken teknik kisimlar
- `openPublicProfileView(...)` state akisi (`loading | ready | error`)
- `fetchMobilePublicProfileSnapshot(...)` donus yapisi
- `resolveUserIdsByAuthorNames(...)` ile eksik `userId` tamamlama mantigi
- Arena/comment profile aksiyonlarinda `userId` zorunlulugu

### Validation (gecti)
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx apps/mobile/src/lib/mobileCommentsFeed.ts apps/mobile/src/lib/mobileArenaSnapshot.ts apps/mobile/src/lib/mobileAuthorUserMap.ts apps/mobile/src/lib/mobilePublicProfileSnapshot.ts scripts/mobile-contract-smoke.mjs`
- `npm run test:mobile:contracts`
- `npm run test:mobile:design:parity`
- `npm run mobile:phase1:release:check:ci`
- `npm run mobile:phase1:release:check:ci`
- `npm run mobile:phase1:release:check:ci`

---

## Report 2026-02-21 - Onboarding first-run persistence (tech only)

### Scope tamamlandi (teknik)
- Intro ekrani sadece ilk acilista gosterilecek sekilde kalici flag altyapisi eklendi.
  - `apps/mobile/src/lib/mobileOnboarding.ts`
  - `readMobileOnboardingSeen()`
  - `writeMobileOnboardingSeen(seen)`
- App boot sirasinda onboarding flag okunup giris stage'i belirlenir hale getirildi.
  - `apps/mobile/App.tsx`
  - Flag `true` ise `entryStage='auth'`, degilse `entryStage='intro'`.
  - Flag okunana kadar app gate bekletiliyor (`isEntryResolved`).
- Intro -> Auth gecisinde onboarding flag set edilir hale getirildi.
  - `apps/mobile/App.tsx`
  - `handleContinueFromIntro` icinde `writeMobileOnboardingSeen(true)` cagrisi eklendi.
- Session hazirsa auth stage'inden main stage'ine otomatik gecis eklendi.
  - `apps/mobile/App.tsx`
  - `entryStage==='auth' && isSignedIn` oldugunda `entryStage='main'`.

### Teknik olarak eklendi ama tasarim olarak gecici
- Onboarding loading aninda bos/sade bekleme var (visual state basic)
- Intro/auth gecis ritmi tamamen teknik; transition polish yok
- Auth gate mesaj dili islevsel ama product polish basic

### Gemini'den istenen tasarim isi
- Onboarding loading anina hafif bir skeleton/transition dili
- Intro -> Auth gecisinde daha net visual continuity
- Intro copy + CTA kartinin hiyerarsi/pacing polish'i
- Tum degisikliklerde mevcut token setinden cikmama (design parity uyumu)

### Degistirilmemesi gereken teknik kisimlar
- `mobileOnboarding` storage key akis mantigi
- `isEntryResolved` ile gate bekletme davranisi
- `readMobileOnboardingSeen` sonucuna gore `entryStage` secimi
- `handleContinueFromIntro` icindeki onboarding write cagrisi

### Validation (gecti)
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/lib/mobileOnboarding.ts`
- `npm run test:mobile:contracts`
- `npm run test:mobile:design:parity`
- `npm run mobile:phase1:release:check:ci`

---

## Report 2026-02-21 - Social tab split for comments (tech only)

### Scope tamamlandi (teknik)
- Tum yorumlar akisi ayri bir alt bar sekmesine tasindi.
  - `apps/mobile/App.tsx`
  - Ayrik `Social` tab route aktif edildi.
- Explore sekmesi yorum akisindan ayrildi; kesif/arena odagina cekildi.
  - `apps/mobile/App.tsx`
- Ana sayfadaki gunluk yorum/ritual gonderme akisi korunarak yerinde birakildi.
  - `apps/mobile/App.tsx`
  - Yorum yazma ana akis: Daily tab
  - Tum yorumlari okuma akis: Social tab

### Teknik olarak eklendi ama tasarim olarak gecici
- Social sekme acilis hierarchy'si islevsel ama visual ritim basic
- Alt bar ikon agirligi (Daily/Social/Explore) denge/polish bekliyor
- Social intro + feed basligi gecici tipografik duzende

### Gemini'den istenen tasarim isi
- Alt barda `Social` sekmenin discover/profile ile gorsel agirligini dengeleme
- Social ekraninda intro -> filtre -> feed akisinda spacing/hierarchy iyilestirmesi
- Explore ekraninda artik "kesif odakli" dil ve card ritmini guclendirme
- Daily ekraninda yorum gonderme alaninin ana akisla iliski vurgusunu netlestirme
- Tum degisikliklerde mevcut token setinden cikmama (design parity uyumu)

### Degistirilmemesi gereken teknik kisimlar
- `MAIN_TAB_BY_KEY.social` route kimligi
- Comment feed state/handler akislari (`refreshCommentFeed`, scope/sort/query)
- Daily tab icindeki ritual/comment submit guard mantigi
- Explore tab icindeki discover + arena teknik aksiyonlari

### Validation (gecti)
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx`
- `npm run test:mobile:contracts`
- `npm run test:mobile:design:parity`

---

## DESIGN CHANGELOG

### 1. Comment Feed Pagination
- `CommentFeedCard` içerisindeki "Daha Fazla Yükle" aksiyonu daha erişilebilir ve platform standartlarına uygun "stretch" bir buton hâline getirildi (`commentFeedLoadMoreButton`).
- Sayfalama verisinin metinsel vurgusu (`commentFeedLoadMoreText`) yumuşatılıp, üst karakter (uppercase) baskısı kaldırılarak marka "clay/sage/muted" renk şemasına tam uyumlu hale getirildi.
- "Tüm sayfalar yüklendi" teknik ibaresi yerine, ürünün premium hissini yansıtan `Akisin Sonuna Geldin` metni (`commentFeedPaginationMeta`) kullanıldı.
- Profil kapalı durumlarındaki "Profil Kilitli" ibaresi, daha samimi bir marka tonuyla "Gızlı Profil" olarak değiştirildi.

### 2. Intro + Auth Gate & Guest Mode
- Adımlı giriş/gateway (`entryStage: 'intro' | 'auth'`) ekranlarında metin hiyerarşisi sıfırdan oluşturuldu (`introGateHeader`, `introGateTitle`, `introGateBody`).
- Intro ekranındaki kullanım özellikleri (rulesList) bir listeye (`rulesRow`, `rulesDot`, `rulesText`) dönüştürülerek görsel bir "card" ritmine oturtuldu. Daha geniş line-height değerleri eklendi.
- Auth Gate ("Üye Ol / Giriş Yap") üzerindeki yoğun teknik görünüm (paddingler, metinlerin birbiri üzerine binmesi) `authGateHeader`, `authGateTitle`, `authGateBody` tarzı component class'larıyla iyileştirilerek "Space Grotesk / Inter" Premium Design Tokens standardına uygun hale getirildi.

Her ekran TypeScript, eslint ve design parity kurallarına tam uyumlu hale getirilip, mevcut "Technical Only" akışlarına (Eventler, State'ler ve API Contratları) dokunmadan uygulandı. Testler başarılı.

---

## Report 2026-02-21 - Daily movie target selection + native public follow (tech only)

### Scope tamamlandi (teknik)
- Web parity audit dokumani eklendi (feature-by-feature inventory).
  - `docs/MOBILE_WEB_PARITY_AUDIT_2026-02-21.md`
  - Webdeki feature'lar tek tek `Var | Kismi | Eksik` olarak siniflandi.
- Daily akista ritual hedefi secilebilir hale getirildi.
  - `apps/mobile/App.tsx`
  - `apps/mobile/src/ui/appScreens.tsx`
  - `apps/mobile/src/ui/appStyles.ts`
  - `apps/mobile/src/ui/appTypes.ts`
  - `apps/mobile/src/lib/dailyApi.ts`
- Daily movie modeli detay metadata tasiyacak sekilde genisletildi.
  - `year`, `director`, `overview`, `posterPath`, `cast`, `originalLanguage`
- Ritual submit akisi artik secilen filme bagli calisiyor.
  - Sabit ilk film yerine `selectedDailyMovie` kullaniliyor.
- Native public profile ekranina follow/unfollow teknik akisi eklendi.
  - `apps/mobile/src/lib/mobileFollowState.ts` (yeni)
  - `apps/mobile/App.tsx`
  - `apps/mobile/src/ui/appScreens.tsx`

### Teknik olarak eklendi ama tasarim olarak gecici
- Daily listede secili film state'i (islev var, visual state basic)
- Public profile takip butonu (islev var, hiyerarsi basic)
- Follow durum/geri bildirim metni (okunur ama polish basic)

### Gemini'den istenen tasarim isi
- `DailyHomeScreen` icinde secili film satirinin visual state ayrimini guclendirme
- `RitualDraftCard` icinde "secili film" bilgisinin hiyerarsisini netlestirme
- `PublicProfileDetailCard` follow aksiyonunun CTA ritmini iyilestirme
- Follow state metinlerini (ready/error/loading) daha urun-dili odakli hale getirme
- Tum degisikliklerde mevcut token setinden cikmama (design parity uyumu)

### Degistirilmemesi gereken teknik kisimlar
- `selectedDailyMovie` -> `handleSubmitRitualDraft` baglantisi
- `DailyState.movies` icindeki yeni alanlarin state contract'i
- `resolveMobileFollowState(...)` ve `toggleMobileFollowState(...)` akis mantigi
- Public profile follow state makinesi (`idle | loading | ready | error`)

### Validation (gecti)
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx apps/mobile/src/ui/appStyles.ts apps/mobile/src/ui/appTypes.ts apps/mobile/src/lib/dailyApi.ts apps/mobile/src/lib/mobileFollowState.ts`
- `npm run test:mobile:contracts`
- `npm run test:mobile:design:parity`

---

## Report 2026-02-21 - Release config hardening (tech only)

### Scope tamamlandi (teknik)
- Store release icin app build numaralari explicit hale getirildi.
  - `apps/mobile/app.json`
  - `ios.buildNumber = "1"`
  - `android.versionCode = 1`
- EAS production profile store dagitimi icin netlestirildi.
  - `apps/mobile/eas.json`
  - `distribution = "store"`
  - `autoIncrement = true`
  - `android.buildType = "app-bundle"`

### Teknik olarak eklendi ama tasarim olarak gecici
- Bu pakette UI/tasarim degisikligi yok.

### Gemini'den istenen tasarim isi
- Bu paket icin tasarim aksiyonu yok.

### Degistirilmemesi gereken teknik kisimlar
- `ios.buildNumber` ve `android.versionCode` release identity alanlari
- `eas.json > build.production` altindaki `distribution/autoIncrement/buildType` release davranisi

### Validation (gecti)
- `npm run mobile:phase1:release:check:ci`

---

## Report 2026-02-21 - Auth callback + password recovery parity (tech only)

### Scope tamamlandi (teknik)
- Mobile auth callback parser/uygulayici eklendi.
  - `apps/mobile/src/lib/mobileAuthCallback.ts` (yeni)
  - Deep-link URL query/hash icindeki `access_token`, `refresh_token`, `code`, `type`, `error` alanlarini parse eder.
  - Supabase tarafinda `setSession(...)` ve `exchangeCodeForSession(...)` ile oturum kurar.
- Entry auth flow mode'lari web parity icin genisletildi.
  - `apps/mobile/App.tsx`
  - `EntryAuthMode`: `sign_in | sign_up | forgot_password | reset_password`
  - Sifre sifirlama talebi (`resetPasswordForEmail`) ve yeni sifre tamamlama (`updateUser`) akislari eklendi.
- OAuth giris akisi mobile auth gate'e baglandi.
  - `apps/mobile/App.tsx`
  - Google OAuth URL acilisi + callback dinleme ile oturum tamamlama teknik olarak baglandi.
- Auth state degisimlerinde recovery senaryosu ele alindi.
  - `apps/mobile/App.tsx`
  - `PASSWORD_RECOVERY` eventi geldiginde app stage zorunlu auth'a cekilir ve reset mode aktiflenir.
- Theme/design parity guard bozulmadan card ve mark satiri teknik duzeltmeleri yapildi.
  - `apps/mobile/src/ui/appScreens.tsx`
  - `apps/mobile/src/ui/appStyles.ts`

### Teknik olarak eklendi ama tasarim olarak gecici
- Auth gate'te `Sifremi Unuttum` / `Yeni Sifre Belirle` state'leri islevsel ama visual hierarchy basic
- OAuth butonunun primary/secondary agirligi su an teknik minimum duzeyde
- Recovery bilgi/meta metinleri okunur ama product tone polish bekliyor

### Gemini'den istenen tasarim isi
- Auth gate icinde 4 mode (`Giris`, `Kayit`, `Sifremi Unuttum`, `Yeni Sifre`) arasi gecislerin hiyerarsi/pacing iyilestirmesi
- Recovery state mesajlarini daha net bir bilgi katmanina cevirme (success/error/info ayrimi)
- Google OAuth aksiyonunun form aksiyonlariyla gorsel denge kurulmasi
- Sifre yenileme modunda input + CTA iliski ritmini guclendirme
- Tum degisikliklerde mevcut token setinden cikmama (design parity uyumu)

### Degistirilmemesi gereken teknik kisimlar
- `applyMobileAuthCallbackFromUrl(...)` donus contract'i (`matched/ok/recoveryMode/message/method`)
- `EntryAuthMode` state makinesi ve `entryStage` gate davranisi
- `PASSWORD_RECOVERY` eventinde auth stage'e zorlama mantigi
- OAuth callback dinleyicisindeki `setSession/exchangeCodeForSession` sira mantigi

### Validation (gecti)
- `npm --prefix apps/mobile exec -- tsc --noEmit`
- `npm run lint -- apps/mobile/App.tsx apps/mobile/src/ui/appScreens.tsx apps/mobile/src/ui/appStyles.ts apps/mobile/src/lib/mobileAuthCallback.ts`
- `npm run test:mobile:contracts`
- `npm run test:mobile:design:parity`
