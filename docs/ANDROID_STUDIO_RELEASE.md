# Android Studio Release Flow

This project can ship Android without consuming EAS cloud build quota by generating a signed Android App Bundle (AAB) in Android Studio.

## Current State

- On March 10, 2026, the EAS remote Android `versionCode` is `22`.
- The next manual Play upload should use `23` or higher.
- After a manual Play upload, sync EAS remote versioning before the next cloud build with `npx eas-cli build:version:set -p android`.

## Signing Inputs

- Use the same upload keystore already associated with Play App Signing / prior EAS Android submissions.
- Copy [apps/mobile/keystore.properties.example](/C:/Users/hsyna/.gemini/antigravity/scratch/180-absolute-cinema/apps/mobile/keystore.properties.example) to `apps/mobile/android/keystore.properties`.
- Place the keystore file at `apps/mobile/android/app/upload-keystore.jks` unless you change `storeFile`.
- If the only copy of the upload key lives in Expo/EAS, export that existing key before building in Android Studio.

## Build Config

The local Android `build.gradle` is prepared to read release signing values from either:
- Android Studio's injected signing properties during `Generate Signed Bundle / APK`
- `apps/mobile/android/keystore.properties`
- Environment variables named `ABSOLUTE_CINEMA_ANDROID_*`

Local Android release builds default to `versionCode 23` unless you override it with one of these:
- Gradle property: `-PabsoluteCinema.android.versionCode=24`
- Environment variable: `ABSOLUTE_CINEMA_ANDROID_VERSION_CODE=24`

`versionName` defaults to `1.0.0` and can be overridden with:
- Gradle property: `-PabsoluteCinema.android.versionName=1.0.1`
- Environment variable: `ABSOLUTE_CINEMA_ANDROID_VERSION_NAME=1.0.1`

## Android Studio Steps

1. Open `apps/mobile/android` in Android Studio.
2. Let Gradle sync finish.
3. Confirm `apps/mobile/google-services.json` is present.
4. Choose `Build > Generate Signed Bundle / APK > Android App Bundle`.
5. Select the existing upload keystore that Play already trusts.
6. Make sure the build uses a `versionCode` higher than the latest Play / EAS remote build.
7. Generate the AAB.
8. Upload the AAB to the Play Console internal track first.
9. Smoke test the internal build before widening rollout.

## Validation

Run this before generating the bundle:

```bash
npm run mobile:phase1:release:check:android
```

Because `apps/mobile/android` is ignored in Git, local native release tweaks on this machine are not captured by the repository unless you reapply them on another checkout.