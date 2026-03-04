# Google Cloud Run Setup

Bu repo icin en dusuk riskli gecis yolu su:

1. Web frontend mevcut yerde kalir.
2. `api/*` endpointleri tek bir Cloud Run servisine tasinir.
3. Web ve mobil istemciler yeni API base URL'ine baglanir.

Bu fazda amac Vercel function limitinden cikmak. Frontend hosting'i ikinci asamada tasinabilir.

## 1. Gerekli ortam degiskenleri

Cloud Run servisinde su degiskenler olmali:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_APP_URL`
- `TMDB_API_KEY`
- `SUPABASE_STORAGE_BUCKET`
- `DAILY_ROLLOVER_TIMEZONE`
- `CRON_SECRET`

Opsiyonel:

- `VITE_PUBLIC_APP_URL`
- `EXPO_PUBLIC_WEB_APP_URL`
- `EXPO_PUBLIC_WEB_BASE_URL`

Not:

- `PUBLIC_APP_URL` degeri web frontend domaini olmali. Ornek: `https://www.180absolutecinema.com`
- `SUPABASE_SERVICE_ROLE_KEY` Secret Manager ile tutulmali.

## 2. Build ve local kontrol

Lokal API servisi:

```bash
npm run api:dev
```

Build:

```bash
npm run build:cloudrun
```

Health check:

```text
http://localhost:8080/healthz
```

Hazirlik kontrolu:

```bash
npm run cloudrun:doctor
```

## 3. Google Cloud Run deploy

Ilk kurulum:

```bash
gcloud auth login
gcloud config set project SENIN_GCP_PROJE_ID
```

Gerekli servisleri ac:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

Repo kokunden deploy:

```bash
gcloud run deploy absolute-cinema-api --source . --region europe-west1 --allow-unauthenticated
```

Bu repoda `Dockerfile` oldugu icin Cloud Run backend'i tek container olarak build eder.

Deploy sirasinda secret degerleri panelden ya da komut satirindan tanimlamalisin. En guvenlisi Google Secret Manager kullanmak.

Ilk deploy sonrasi Cloud Run sana bir servis URL'i verecek:

```text
https://absolute-cinema-api-xxxxxx-ew.a.run.app
```

## 4. Web ayarlari

Web frontend kendi hosting'inde kalirken yeni API'ye su sekilde baglanir:

`.env`

```env
VITE_API_BASE_URL=https://absolute-cinema-api-xxxxxx-ew.a.run.app
VITE_PUBLIC_APP_URL=https://www.180absolutecinema.com
```

Sonra web frontend yeniden build/deploy edilir.

## 5. Mobil ayarlari

`apps/mobile/.env.release`

```env
EXPO_PUBLIC_ANALYTICS_ENDPOINT=https://absolute-cinema-api-xxxxxx-ew.a.run.app/api/analytics
EXPO_PUBLIC_DAILY_API_URL=https://absolute-cinema-api-xxxxxx-ew.a.run.app/api/daily
EXPO_PUBLIC_REFERRAL_API_BASE=https://absolute-cinema-api-xxxxxx-ew.a.run.app
EXPO_PUBLIC_PUSH_API_BASE=https://absolute-cinema-api-xxxxxx-ew.a.run.app
EXPO_PUBLIC_WEB_APP_URL=https://www.180absolutecinema.com
```

Bu sayede mobil, backend'i Cloud Run'dan kullanirken web linkleri ana domaine donmeye devam eder.

## 6. Cron gecisi

Vercel cron yerine Cloud Scheduler kullan:

- hedef URL: `https://<cloud-run-url>/api/cron/daily`
- method: `GET`
- header: `Authorization: Bearer <CRON_SECRET>`
- schedule: `0 21 * * *`

`21:00 UTC`, Istanbul gun degisimini mevcut uygulama akisina uygun tutar.

## 7. Domain stratejisi

En dusuk maliyetli ilk yayin:

- API icin Cloud Run'in verdigi `run.app` URL'i kullan

Daha temiz ikinci asama:

- `api.180absolutecinema.com` gibi ayri bir alt domain bagla

Bu ikinci asamayi sistem oturduktan sonra yapmak daha mantikli.
