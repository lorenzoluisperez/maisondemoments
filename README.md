# Maison de Moments

Designer-operated software for premium interactive invitations. The public collection includes three wedding designs and two debut showcases, Pearl & Poise and Eighteen in Wonderland; the underlying platform retains all four event schemas.

## Current focus

Garden Romance, Coastal Romance, and Heritage Romance are viewing-only wedding showcases. Pearl & Poise and Eighteen in Wonderland form the Debuts / 18th Birthdays category, with fictional samples at `/demo/debut-pearl` and `/demo/debut-wonderland`. Browse all five designs at `/designs`. Visitors inquire and order by messaging on Facebook or Instagram, following `/how-to-order`. Configure `FACEBOOK_PAGE_URL` and `INSTAGRAM_PROFILE_URL` with real HTTPS URLs before directing visitors to the site. The code keeps online checkout and customer portal routes paused. The existing commerce and private-workspace foundation is deferred. See the [product plan](docs/product-and-technical-plan.md#current-public-release).

## Implemented foundation (private workflows deferred)

- Eight event and collection presets with one semantic, naturally scrollable, reduced-motion-aware renderer
- Always-available Details and RSVP controls, long participant-list handling, and synthetic public demos
- Persistent event-specific customer portal with incremental autosave, completeness guidance, photo attachments, and explicit submission
- Automatic collection-pinned draft generation and a constrained production studio with conflict-safe autosave, undo/redo, responsive previews, and bounded design controls
- Frozen client reviews with exact-version approval, consolidated feedback, material-change labels, payment-gated admin publication, compatible rollback, and access controls
- Admin job-order intake with in-place customer account creation, package terms, event baselines, assignment, and commercial amounts
- Household entry and CSV import, allocated adult and child seats, revocable private links, guest sessions, deadline-aware RSVP amendments, audited corrections, and formula-safe exports
- Customer and staff sign-out from every private workspace
- Append-only payment ledger, exact reversals, signed PayMongo settlement intake, production queues, failed-task retry, and role-aware workspace navigation
- Fixed transactional email tasks, structured logs, privacy-reduced Sentry reporting, and protected scheduled operations
- Off-provider media backup with checksum verification, backup-gated publication, expiry, removal, deletion tombstones, and guarded restoration replay
- Strict Zod event, invitation, upload, and RSVP contracts
- PostgreSQL schema for accounts, orders, catalog, immutable versions, reviews, households, seats, payments, audit history, and durable tasks
- Persistent account and order APIs with Supabase Auth session verification and normalized event storage
- Private signed media uploads, durable Sharp processing, immutable responsive variants, authorized delivery, and cleanup
- Persistent artwork collections, typed asset metadata, immutable theme versions, and stable renderer asset bindings
- Least-privilege pooled database runtime, locked Data API tables, RLS, and repeatable database verification
- Transaction-safe JO allocation, exact-version publication gate, immutable version trigger, and leased task claiming
- Role checks for customers, assigned designers, and admins
- 256-bit household token generation, keyed digest lookup, encrypted reissue storage, and timing-safe comparison
- Domain and database integration tests for event types, snapshots, content persistence, generated drafts, studio conflicts, permissions, tenant isolation, JO concurrency, RSVP rules, and credentials

The dormant portal and studio foundation uses authenticated PostgreSQL data through purpose-specific server APIs. Public demos remain synthetic. Historical private invitations use household bearer links and server-verified guest sessions for real RSVP data.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

Open:

- `/` and `/designs` for the public storefront
- `/designs/garden-romance` for a product page and fictional preview
- `/demo/wedding`, `/demo/wedding-beach`, and `/demo/wedding-bridgerton` for the three wedding studies
- `/demo/debut-pearl` for Pearl & Poise, with four celebration lists of 18 names and demonstration-only RSVP
- `/demo/debut-wonderland` for Eighteen in Wonderland, with a golden-key opening, watercolor storybook chapters, four lists of 18 names, and demonstration-only RSVP
- `/how-to-order` for the inquiry steps and social contact links

The previous `/portal`, `/admin`, `/studio`, `/review`, `/login`, and checkout pages currently redirect to `/how-to-order`.

Validate the current showcase:

```bash
npm run check
npx playwright test tests/e2e/storefront.spec.ts
npm run build
```

The deferred private workflows have additional checks that require development or staging infrastructure:

```bash
npm run test:db
npm run db:verify
npm run media:verify
npm run db:generate
npm run guest:verify
# Requires a disposable database, backup credentials, PostgreSQL client tools, and the confirmation variable.
npm run ops:restore-drill
```

Check the wedding demo in desktop and mobile Chromium. Playwright starts the local server automatically for the browser check.

```bash
npm run test:e2e:setup
npm run test:e2e
```

## Public showcase deployment

Set `FACEBOOK_PAGE_URL` and `INSTAGRAM_PROFILE_URL` to the verified HTTPS URLs for the actual accounts before building or redeploying. Check both links on desktop and mobile before sharing the site. Leave `COMMERCE_CHECKOUT_ENABLED=false` and do not configure PayMongo for this release. The site displays labeled social placeholders until URLs are set.

## Deferred private-workflow production setup

1. Create separate Supabase projects for staging and production.
2. Set the pooled `DATABASE_URL` for `maison_app` and the privileged, session-pooled `MIGRATION_DATABASE_URL` only in migration environments.
3. Run `npm run db:migrate`, `npm run db:configure-role`, and `npm run db:verify` through the migration environment.
4. Run `npm run storage:setup`, `npm run catalog:seed`, and `npm run media:verify` from a trusted server environment.
5. Configure the remaining values documented in `.env.example`. Never expose the Supabase secret key, background-job secret, guest-token secrets, or database URLs to the browser.
6. Configure the Supabase email OTP template with `{{ .Token }}` for customer codes, and enroll staff TOTP MFA.
7. Configure the real Facebook and Instagram contact URLs for the public showcase. Keep `COMMERCE_CHECKOUT_ENABLED=false`; PayMongo checkout and customer portals are deferred. Configure private infrastructure only when that phase resumes. Vercel schedules the combined operations endpoint from `vercel.json`.
8. Deploy to Vercel only after integration, browser, restore, and real-device gates pass. The optional `dev:sites` and `build:sites` scripts retain the portable preview path used during initial UI construction.

Supabase uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for browser and user-scoped server clients. Only privileged server code may use `SUPABASE_SECRET_KEY`. Keep real values in ignored environment files and maintain required variable names in `.env.example`.

See the [canonical product and technical plan](docs/product-and-technical-plan.md), [Phase 1 acceptance record](docs/phase-1-acceptance.md), [Phase 2 acceptance record](docs/phase-2-acceptance.md), [Phase 3 acceptance record](docs/phase-3-acceptance.md), [Phase 4 acceptance record](docs/phase-4-acceptance.md), [Phase 5 acceptance record](docs/phase-5-acceptance.md), [Phase 6 acceptance record](docs/phase-6-acceptance.md), [Phase 7 acceptance record](docs/phase-7-acceptance.md), [architecture decisions](docs/adr/README.md), and [production runbook](docs/operations.md).
