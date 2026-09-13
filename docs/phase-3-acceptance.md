# Phase 3 media and renderer acceptance

## Implemented production path

- The server creates idempotent upload intents after checking order ownership, assignment, file policy, count quota, and byte quota.
- Browsers upload directly to the private `maison-quarantine` bucket with a scoped signed upload token and the publishable Supabase key.
- Finalization verifies the stored object size and declared content type before enqueueing one idempotent durable job.
- The leased worker downloads finalized objects with the server-only secret key and processes no more than two images per invocation by default.
- Sharp detects the actual JPEG, PNG, or WebP format, rejects malformed or animated input, enforces 25 MB and 50-megapixel limits, applies orientation, normalizes sRGB color, and strips metadata.
- Recipe version 1 creates immutable WebP derivatives up to 480, 960, and 1600 pixels wide and 2400 pixels tall.
- Validated originals and derivatives move into the private media bucket. Quarantine-copy removal is retryable.
- Personalized delivery uses short-lived signed URLs after application-level order authorization.
- Abandoned quarantine uploads and expired rejected uploads enter an idempotent deletion workflow.
- Database triggers prevent cross-order or cross-customer version references and prevent deletion while a retained version references the media.

## Catalog and renderer

- Midnight Garden and Luminous Parchment are persisted as active artwork collections, media objects, typed artwork assets, themes, and immutable theme versions.
- Artwork metadata records dimensions, visible bounds, anchor, tags, intended placements, animation compatibility, artist, rights classification, and source-file custody.
- All eight event and collection presets bind scenes to stable catalog asset keys.
- Invitation snapshots contain stable media IDs and alt text. Expiring signed URLs are added only to an authorized render model.
- The shared guest renderer supports responsive private gallery sources without importing database or storage code.
- GSAP loads after the usable document is rendered, keeping motion progressive and outside the initial guest JavaScript budget.

## Verified gates

- 29 domain tests cover media policy, malformed input, derivative generation, metadata stripping, catalog schemas, stable media hashes, and all eight preset bindings.
- 11 live database and storage tests cover signed browser uploads, finalization, worker processing, signed delivery, malformed-file rejection, customer isolation, retained-version guards, cleanup, bounded retries, JO allocation, and order ownership.
- The configured Supabase project has two private media buckets, two collections, two artwork assets, and two released theme versions.
- Database verification reports 30 RLS-enabled application tables, no browser-role table grants, no public function grants, and no missing foreign-key indexes.
- All eight prerendered invitation demos pass these measured production-build budgets:
  - Maximum initial guest JavaScript: 191.6 KiB compressed.
  - Maximum critical artwork: 225 KiB.
  - Maximum critical transfer: 445.3 KiB.
  - Active and adjacent decoded image allowance: 29.3 MiB.
- Desktop and 390×844 mobile browser checks passed for both collections, persistent Details and RSVP access, and natural long-list scrolling. The checked flows produced no console errors or warnings.

## Remaining release gate

Physical iPhone Safari, lower-powered Android Chrome, Messenger, and WhatsApp in-app browser checks remain part of the Phase 1 release gate. Browser automation does not replace those device results.
