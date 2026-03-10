# 180 Absolute Cinema

App Store Connect copy pack for iOS version 1.0.

## Global URLs

### Marketing URL

- https://180absolutecinema.com/

### Privacy Policy URL

- https://180absolutecinema.com/privacy/

### Support URL

- Blocked pending a dedicated support page or contact page with real contact details.

Note:
- The current homepage exposes social links plus the privacy and account deletion pages, but Apple support guidance expects the Support URL to lead to actual contact information.

### Account Deletion Reference

- https://180absolutecinema.com/account-deletion/

## App Information Screen

Use these values on `Distribution > App Information` for the iOS app record.

### Localizable Information

#### English (U.S.)

- Name: 180 Absolute Cinema
- Subtitle: Daily Film Rituals & Reviews

### General Information

- Primary Language: English (U.S.)
- Primary Category: Entertainment
- Secondary Category: Social Networking

### Content Rights

- Do not leave this unresolved before submission.
- The product shows third-party movie metadata/posters and also hosts user-generated comments.
- In App Store Connect, only confirm rights to third-party content if you can document that right for App Review. If review asks for proof, be ready to provide your TMDB/content licensing basis or remove the third-party content from the app metadata/build.

### Support URL Note

- Do not rely on the homepage alone for final submission.
- Create a dedicated support page or contact page that includes a real support email address and/or other direct contact information, then use that page as the Support URL.

## App Privacy

Use these selections for `App Privacy > Data Collection` for the current iOS build.

### Initial Question

- Do you or your third-party partners collect data from this app: Yes

### Data Types To Disclose

- Contact Info > Name
- Contact Info > Email Address
- Contacts
- User Content > Photos or Videos
- User Content > Other User Content
- Identifiers > User ID
- Identifiers > Device ID
- Usage Data > Product Interaction
- Other Data

### Why These Apply

- The mobile registration and profile flows collect full name, username, birth date, and email, and sync profile state to the backend.
- The app lets users pick an avatar image from the device photo library, stores that avatar in profile state, and syncs profile identity to the backend.
- The product stores user-generated comments, rituals, replies, reactions, follows, and invite activity.
- The social graph includes follower/following relationships, which is safer to treat as `Contacts` because Apple includes social graph data in that category.
- The mobile app sends analytics events with session-level event data and can include user-level identifiers.
- The app persists device-level keys for referrals and push notification state, and syncs push token/device state to the backend.
- `Other Data` is the conservative bucket for profile fields that do not fit the named Apple categories cleanly, such as birth date, gender, profile link, and notification permission state.

### Leave Unselected For The Current Build

- Phone Number
- Physical Address
- Other User Contact Info
- Health, Fitness, Financial Info, and Location
- Sensitive Info
- Emails or Text Messages
- Audio Data
- Gameplay Content
- Customer Support
- Browsing History
- Search History
- Purchases
- Advertising Data
- Other Usage Data
- Crash Data
- Performance Data
- Other Diagnostic Data
- Environment Scanning, Hands, Head

### Practical Notes

- Most of the disclosed data is part of core account, profile, comment, social, analytics, referral, and push functionality, so the optional-disclosure carveout is not a clean fit.
- Based on the current repo, there is no visible ad SDK or cross-app advertising tracker, so do not mark this data as used for tracking unless your production build includes something outside this repo.
- If the App Privacy summary screen shows `Other Diagnostic Data`, go back and correct it. For the current repo, `Other Data` is the safer category; there is no clear crash-reporting or technical diagnostics SDK that justifies `Other Diagnostic Data`.
- If you later add crash reporting, ad attribution SDKs, phone collection, address collection, in-app support forms, or purchases, revisit the privacy answers before shipping the updated build.

## Age Ratings

### Step 1: Features

Use these selections for the current product surface:

- Parental Controls: No
- Age Assurance: No
- Unrestricted Web Access: No
- User-Generated Content: Yes
- Messaging and Chat: Yes
- Advertising: No

### Why

- The app includes broadly distributed user comments and replies.
- Users can interact socially through comments, replies, Echo reactions, and follows.
- The app opens specific first-party web surfaces, but it does not function as a general-purpose browser with free web navigation.
- The current product does not include parental control tooling, age verification, or paid in-app advertising.

### Step 2: Mature Themes

Use these selections for the current product surface:

- Profanity or Crude Humor: Infrequent
- Horror/Fear Themes: Infrequent
- Alcohol, Tobacco, or Drug Use or References: Infrequent

### Why

- `None` is too aggressive for the current build because the app shows movie posters, genres, and overviews from third-party film metadata, and it also distributes user comments and replies.
- Profanity risk is reduced by comment moderation, but not to a level that safely justifies `None`.
- Horror and substance references can appear in film metadata and discussion, but they are not the primary or constant focus of the product, so `Frequent` would overstate the surface.

### Step 3: Medical or Wellness

Use these selections for the current product surface:

- Medical or Treatment Information: None
- Health or Wellness Topics: No

### Why

- The app is a film discovery, comment, and social profile product.
- There is no medical guidance, treatment guidance, diagnosis flow, or health/wellness coaching surface in the current build.

### Step 4: Sexuality or Nudity

Use these selections for the current product surface:

- Mature or Suggestive Themes: Infrequent
- Sexual Content or Nudity: Infrequent
- Graphic Sexual Content and Nudity: None

### Why

- The app is not an adult-content product, but it does surface third-party film metadata and user comments, so `None` on every row would be too aggressive.
- TMDB adult-title fetch is explicitly disabled in the daily movie selection flow.
- `Graphic Sexual Content and Nudity` should remain `None` because the current product does not intentionally distribute explicit sexual content or explicit nudity as a core surface.

### Step 5: Violence

Use these selections for the current product surface:

- Cartoon or Fantasy Violence: Infrequent
- Realistic Violence: Infrequent
- Prolonged Graphic or Sadistic Realistic Violence: None
- Guns or Other Weapons: Infrequent

### Why

- The app shows third-party film metadata, including titles, genres, and overviews, so violence-related references can appear in movie detail surfaces.
- Seed and editorial examples already include crime, murder, fantasy peril, and weapon-adjacent film contexts.
- The product is not built around graphic violence, gore, or prolonged sadistic depictions, so `Frequent` would overstate the actual surface and `Graphic ... Violence` should remain `None`.

### Step 6: Chance-Based Activities

Use these selections for the current product surface:

- Simulated Gambling: None
- Contests: Frequent
- Gambling: No
- Loot Boxes: No

### Why

- The app does not include betting, wagering, casino mechanics, purchasable random rewards, or loot-box style monetization.
- But the product does regularly expose rankings, rewards, and personal-goal progression through weekly leaderboard, XP, leagues, streaks, marks, and reward flows.
- Because those competition and achievement surfaces are part of the normal product loop, `Contests` is safer as `Frequent` than `Infrequent`.

### Step 7: Additional Information

Use these selections for the current product surface:

- Calculated Rating: 13+
- Age Categories and Override: Not Applicable
- Age Suitability URL: Leave blank

### Why

- The current flow has already calculated `13+` from the previous answers.
- There is no separate age-gated legal category or product-specific EULA requirement in the repo that would justify forcing a higher manual override.
- The Age Suitability URL field is optional, and there is no dedicated age-suitability policy page in the current project.

### Regional Availability Note

- If App Store Connect shows local-law restrictions for countries or regions such as Afghanistan or Morocco, that is a store policy outcome of the selected content profile, not necessarily a submission error.

## Localized Metadata

### English (U.S.)

#### App Name

- 180 Absolute Cinema

#### Subtitle

- Daily Film Rituals & Reviews

#### Promotional Text

- A daily film ritual for cinephiles: get 5 curated picks, write one focused comment, build streaks, and grow your cinema profile.

#### Keywords

- cinema,movies,film,discovery,daily,reviews,cinephile,letterboxd,watchlist,streaks

#### Description

180 Absolute Cinema is a focused daily film ritual for cinephiles.

Every day you get 5 curated film picks. Choose one title, answer the daily quiz, and write a precise short-form comment to keep your streak moving. As you stay consistent, your profile grows with XP, league progress, marks, archives, and social signals from other movie lovers.

Features:
- 5 curated films every day
- Focused short-form comments built around a 180-character ritual
- Daily quiz flow that unlocks comments and awards XP
- Streak tracking, XP progression, and league levels
- Comment feed with Echo reactions, replies, and follows
- Personal profile with stats, marks, and watched film archive
- Letterboxd CSV import to bring your watch history into the app
- Editorial discovery routes for mood films, director deep dives, and daily curated picks

180 is built for people who want better film discovery, sharper writing, and a cleaner cinema community experience.

#### Validation

- Subtitle: 28 / 30
- Promotional Text: 128 / 170
- Keywords: 81 / 100

### Turkish (Türkiye)

#### App Name

- 180 Absolute Cinema

#### Subtitle

- Günlük film ritüeli ve yorum

#### Promotional Text

- Sinefiller için günlük film ritüeli: 5 seçili film keşfet, odaklı bir yorum yaz, serilerini koru ve sinema profilini geliştir.

#### Keywords

- sinema,film,filmler,keşif,günlük,yorum,sinefil,letterboxd,izleme listesi,seri

#### Description

180 Absolute Cinema, sinefiller için odaklı bir günlük film ritüelidir.

Her gün 5 özenle seçilmiş film görürsün. Bir yapım seç, günlük quiz'i tamamla ve serini sürdürmek için kısa ama net bir yorum yaz. Düzenli kaldıkça profilin XP, lig ilerlemesi, işaretler, arşiv ve diğer sinemaseverlerden gelen sosyal sinyallerle büyür.

Özellikler:
- Her gün 5 özenle seçilmiş film
- 180 karakter ritüeline dayalı odaklı kısa yorumlar
- Yorumu açan ve XP kazandıran günlük quiz akışı
- Seri takibi, XP ilerlemesi ve lig sistemi
- Echo tepkileri, yanıtlar ve takiplerle yorum akışı
- İstatistikler, işaretler ve izlenen film arşivi olan kişisel profil
- İzleme geçmişini uygulamaya taşımak için Letterboxd CSV içe aktarma
- Ruh haline göre filmler, yönetmen derin incelemeleri ve günlük seçkiler için editoryal keşif rotaları

180, daha iyi film keşfi, daha keskin yazı disiplini ve daha temiz bir sinema topluluğu isteyenler için tasarlandı.

#### Validation

- Subtitle: 28 / 30
- Promotional Text: 126 / 170
- Keywords: 77 / 100

### German (Germany)

#### App Name

- 180 Absolute Cinema

#### Subtitle

- Tägliches Filmritual & Kritik

#### Promotional Text

- Das tägliche Filmritual für Cineasten: 5 kuratierte Filme entdecken, einen fokussierten Kommentar schreiben, Serien halten und dein Filmprofil ausbauen.

#### Keywords

- kino,filme,filmkritik,entdecken,täglich,rezension,cineast,letterboxd,watchlist,streak

#### Description

180 Absolute Cinema ist ein fokussiertes tägliches Filmritual für Cineasten.

Jeden Tag erhältst du 5 kuratierte Filmtipps. Wähle einen Titel, beantworte das tägliche Quiz und schreibe einen präzisen Kurzkommentar, um deine Serie fortzusetzen. Mit konsequenter Nutzung wächst dein Profil durch XP, Ligafortschritt, Marks, Archiv und soziale Signale anderer Filmliebhaber.

Features:
- 5 kuratierte Filme jeden Tag
- Fokussierte Kurzkommentare rund um das 180-Zeichen-Ritual
- Täglicher Quiz-Flow, der Kommentare freischaltet und XP vergibt
- Serien-Tracking, XP-Fortschritt und Ligen
- Kommentar-Feed mit Echo-Reaktionen, Antworten und Follows
- Persönliches Profil mit Statistiken, Marks und Filmarchiv
- Letterboxd CSV-Import, um deine Filmhistorie in die App zu bringen
- Redaktionelle Entdeckungsrouten für Stimmungen, Regisseur-Deep-Dives und Daily Curated Picks

180 ist für Menschen gemacht, die bessere Filmentdeckung, präziseres Schreiben und eine klarere Film-Community suchen.

#### Validation

- Subtitle: 29 / 30
- Promotional Text: 152 / 170
- Keywords: 85 / 100

### French (France)

#### App Name

- 180 Absolute Cinema

#### Subtitle

- Rituel cinéma & critiques

#### Promotional Text

- Le rituel cinéma quotidien des cinéphiles : 5 films choisis, un commentaire précis, des séries à garder et un profil cinéma à faire grandir.

#### Keywords

- cinéma,films,critique,découverte,quotidien,cinéphile,letterboxd,watchlist,série,avis

#### Description

180 Absolute Cinema est un rituel cinéma quotidien et précis pour les cinéphiles.

Chaque jour, tu reçois 5 films sélectionnés. Choisis un titre, réponds au quiz du jour et écris un commentaire court et précis pour garder ta série active. Avec la régularité, ton profil progresse avec des XP, des ligues, des marks, des archives et les signaux sociaux d'autres passionnés de cinéma.

Fonctionnalités :
- 5 films sélectionnés chaque jour
- Des commentaires courts autour d'un rituel de 180 caractères
- Un quiz quotidien qui débloque les commentaires et attribue des XP
- Suivi des séries, progression XP et ligues
- Fil de commentaires avec réactions Echo, réponses et suivis
- Profil personnel avec statistiques, marks et archive de films vus
- Import CSV Letterboxd pour intégrer ton historique de visionnage
- Parcours éditoriaux autour des films par humeur, des plongées réalisateur et des sélections du jour

180 est conçu pour ceux qui veulent une meilleure découverte cinéma, une écriture plus nette et une communauté plus propre.

#### Validation

- Subtitle: 25 / 30
- Promotional Text: 140 / 170
- Keywords: 84 / 100

### Spanish (Spain)

#### App Name

- 180 Absolute Cinema

#### Subtitle

- Cine diario y comentarios

#### Promotional Text

- Un ritual diario para cinéfilos: recibe 5 películas seleccionadas, escribe un comentario enfocado, mantén tu racha y haz crecer tu perfil.

#### Keywords

- cine,películas,film,descubrir,diario,reseñas,cinéfilo,letterboxd,watchlist,racha

#### Description

180 Absolute Cinema es un ritual diario de cine pensado para cinéfilos.

Cada día recibes 5 películas seleccionadas. Elige un título, responde el quiz diario y escribe un comentario breve y preciso para mantener tu racha. Con constancia, tu perfil crece con XP, progreso de liga, marks, archivo y señales sociales de otros amantes del cine.

Funciones:
- 5 películas seleccionadas cada día
- Comentarios breves basados en el ritual de 180 caracteres
- Quiz diario que desbloquea comentarios y otorga XP
- Seguimiento de rachas, progreso XP y ligas
- Feed de comentarios con reacciones Echo, respuestas y seguimiento a otros usuarios
- Perfil personal con estadísticas, marks y archivo de películas vistas
- Importación de CSV de Letterboxd para llevar tu historial a la app
- Rutas editoriales para películas por estado de ánimo, director deep dives y selecciones diarias

180 está hecha para quienes buscan mejor descubrimiento de cine, una escritura más precisa y una comunidad más limpia.

#### Validation

- Subtitle: 25 / 30
- Promotional Text: 138 / 170
- Keywords: 80 / 100

## Screenshot Plan

Use populated real data only. Avoid loading, empty, debug, or placeholder states.

### Screenshot 1

- Capture target: Daily tab / curated 5-film rail
- Headline: 5 curated films. Every day.
- Supporting line: Start a focused cinema ritual with a fresh daily selection.

### Screenshot 2

- Capture target: Film detail plus comment composer
- Headline: Write one precise comment
- Supporting line: Turn every watch into a short-form note built around the 180 ritual.

### Screenshot 3

- Capture target: Profile screen with streak, XP, league, and marks visible
- Headline: Track streaks, XP, and leagues
- Supporting line: See your rhythm, progress, and cinema identity in one place.

### Screenshot 4

- Capture target: Comment feed with Echo and follow actions visible
- Headline: Follow the signal, not the noise
- Supporting line: Browse comments, react with Echoes, and follow other cinephiles.

### Screenshot 5

- Capture target: Archive or Letterboxd import state with watched films visible
- Headline: Build your personal film archive
- Supporting line: Keep watched titles, marks, and imported history together.

### Screenshot 6

- Capture target: Discover routes or editorial picks surface
- Headline: Go deeper than the homepage
- Supporting line: Explore mood picks, director deep dives, and daily curated paths.

## Submission Notes

- First 3 screenshots matter most because they are the most visible in App Store surfaces.
- Keep overlay copy large and short. One headline plus one supporting line is enough.
- For the 6.5-inch slot, export clean portrait screenshots at App Store Connect accepted sizes.
- If Apple asks for support handling, point review to the dedicated support page plus the privacy and account deletion pages.
