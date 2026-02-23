# Mobile Web Parity Audit (2026-02-21)

Bu audit web feature setini tek tek cikartip mobildeki durumunu ayirir.
Kaynak taramasi:
- `src/App.tsx`
- `src/features/*`
- `src/components/*`
- `apps/mobile/App.tsx`
- `apps/mobile/src/ui/appScreens.tsx`
- `apps/mobile/src/lib/*`

## Parity Matrix

| Web feature | Mobile durumu | Not |
| --- | --- | --- |
| Landing / ilk acilis anlatim ekrani | Var | Mobilde `intro` gate ile mevcut. |
| Login + signup | Var | Mobilde email/sifre giris + kayit var. |
| Forgot password + reset password | Eksik | Web `LoginView` var; mobilde teknik akis henuz yok. |
| Google OAuth login | Eksik | Webde var, mobilde yok. |
| Guest olarak devam | Var | Mobilde gate icinde mevcut. |
| Daily 5 liste | Var | Mobilde `DailyHomeScreen` var. |
| Daily cycle timer | Eksik | Web `CycleTime`, mobilde yok. |
| Daily kartindan film detayina giris | **Var (bu paketle eklendi, temel)** | Mobilde gunluk listeden secim rituel hedefi oluyor. |
| Daily 5 icinde secili filme yorum yazma | **Var (bu paketle eklendi)** | Rituel artik ilk film yerine secili film uzerinden gider. |
| Mystery slot lock (#5) | Eksik | Webde var, mobilde yok. |
| Ritual yazma akisi (180 char) | Var | Mobilde `RitualDraftCard` + queue var. |
| Ritual rating (1-10) | Eksik | Web `WriteOverlay` var, mobilde yok. |
| Tum yorumlar sosyal akis | Var | Mobil `Social` tab + `CommentFeedCard`. |
| Social filter/sort/search/pagination | Var | `scope/sort/query/page` mevcut. |
| Echo/reaction aksiyonu | Eksik | Mobilde sadece echo sayisi okunuyor. |
| Reply yazma/okuma thread | Eksik | Mobilde reply count var, thread aksiyonu yok. |
| Feed satirindan follow/unfollow | Eksik | Mobilde profil acilisi var, follow feed satirinda yok. |
| Feed satirindan author profile acma | Var | Mobil native profile acilisi mevcut. |
| Arena leaderboard | Var (ozet) | Mobilde leaderboard karti var, tam arena feed degil. |
| Arena hot streak badge davranisi | Eksik | Webde var, mobilde yok. |
| Profil metrikleri (XP/streak/days/follow) | Var (ozet) | Mobil `ProfileSnapshotCard`. |
| Profil marks/vitrin | Var (ozet) | Mobil `ProfileMarksCard`. |
| Profil film arsivi + film bazli yorum modal | Eksik | Web `ProfileView` detaylari mobilde yok. |
| Share bonus / share hub mantigi | Kismi | Mobilde `share_hub` route var, webdeki tam share bonus sistemi yok. |
| Settings modal (identity/theme/lang/invite/import/logout) | Eksik | Webde kapsamli, mobilde teknik parcalar daginik. |
| Public profile native detay ekrani | Var | Mobil native public profile mevcut. |
| Public profile follow/unfollow | **Var (bu paketle eklendi, temel)** | Mobil native profile uzerinden takip/takipten cik. |
| Notification center (in-app) | Eksik | Webde var, mobilde push inbox var ama ayni davranis degil. |
| Discover routes | Var | Mobil `Explore` tabda aciliyor. |
| Platform rules card | Var | Mobilde mevcut. |
| Web-to-app prompt | N/A | Web acquisition yuzeyi, mobilde karsiligi gerekmez. |

## Bu Paketle Kapatilan Bosluklar

1. Daily yorum hedefi sabit ilk film olmaktan cikarildi; kullanici gunluk listeden film secip rituel gonderebiliyor.
2. Native public profile ekranina follow/unfollow teknik akisi eklendi.

## Sonraki Teknik Paket Onceligi

1. `forgot/reset password` + `OAuth` parity (auth completeness)
2. Social item interaction parity (`echo/reply`) 
3. Profile advanced parity (`film archive`, `settings/invite/import`)
