# Mobile Phase-1 Package 5.7 (Ritual Draft Queue + Retry)

## Summary
- Added mobile ritual submission path for Daily screen with Supabase insert.
- Added offline-safe draft queue persisted in AsyncStorage for failed ritual writes.
- Added manual retry action to flush queued drafts back to cloud when session/network is available.

## Changed Files
- `apps/mobile/App.tsx`
- `apps/mobile/src/lib/mobileRitualQueue.ts`
- `docs/MOBILE_PHASE1_PACKAGE_5_7.md`
- `README.md`

## Behavior
- Daily screen now includes a `Ritual Draft` card.
- On `Ritual Kaydet`:
  - tries direct `public.rituals` insert via mobile Supabase session.
  - if insert fails, draft is queued locally with attempt/error metadata.
- On `Kuyrugu Tekrar Dene`:
  - queued drafts for current session user are retried in batch.
  - successful items are removed from queue.
  - failed items remain in queue with incremented retry count.

## Notes
- Queue is capped (`40` drafts) to avoid unbounded local growth.
- Text validation keeps ritual draft length at max `180` chars.
- This package addresses Phase-1 offline-first requirement for `queue ritual drafts for retry`.
