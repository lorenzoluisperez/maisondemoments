# Maison de Moments

Designer-operated software for producing premium interactive invitations. The first release supports weddings, birthdays, debuts, and christenings across two versioned artwork collections.

## Implemented foundation

- Eight event and collection presets with one semantic, naturally scrollable, reduced-motion-aware renderer
- Always-available Details and RSVP controls, long participant-list handling, and synthetic public demos
- Persistent event-specific customer portal with incremental autosave, completeness guidance, photo attachments, and explicit submission
- Automatic collection-pinned draft generation and a constrained production studio with conflict-safe autosave, undo/redo, responsive previews, and bounded design controls
- Frozen client reviews with exact-version approval, consolidated feedback, material-change labels, payment-gated admin publication, compatible rollback, and access controls
- Admin job-order intake with in-place customer account creation, package terms, event baselines, assignment, and commercial amounts
- Household entry and CSV import, allocated adult and child seats, revocable private links, guest sessions, deadline-aware RSVP amendments, audited corrections, and formula-safe exports
- Customer and staff sign-out from every private workspace
- Append-only manual payment ledger, exact reversals, production queues, failed-task retry, and role-aware workspace navigation
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

The portal and studio use authenticated PostgreSQL data through purpose-specific server APIs. Public demos remain synthetic. Published invitations use household bearer links and server-verified guest sessions for real RSVP data.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

Open:

- `/` for the collection catalog
- `/i/wedding-midnight-garden-demo` for a guest experience
- `/portal` for the customer workflow
- `/studio` for the designer queue and constrained editor
- `/studio/orders/new` for admin job-order intake
- `/studio/operations` for admin production and infrastructure queues

Run validation:

```bash
npm run check
npm run test:db
npm run db:verify
npm run media:verify
npm run db:generate
npm run build
npm run guest:verify
# Requires a disposable database, backup credentials, PostgreSQL client tools, and the confirmation variable.
npm run ops:restore-drill
```

Check the wedding demo in desktop and mobile Chromium. Playwright starts the local server automatically for the browser check.

```bash
npm run test:e2e:setup
npm run test:e2e
```

## Production setup

1. Create separate Supabase projects for staging and production.
2. Set the pooled `DATABASE_URL` for `maison_app` and the privileged, session-pooled `MIGRATION_DATABASE_URL` only in migration environments.
3. Run `npm run db:migrate`, `npm run db:configure-role`, and `npm run db:verify` through the migration environment.
4. Run `npm run storage:setup`, `npm run catalog:seed`, and `npm run media:verify` from a trusted server environment.
5. Configure the remaining values documented in `.env.example`. Never expose the Supabase secret key, background-job secret, guest-token secrets, or database URLs to the browser.
6. Enable Supabase email OTP for customers and MFA-enforced staff sign-in.
7. Configure `CRON_SECRET`, Resend, the server-only Sentry DSN, Supabase PITR, and a separate S3-compatible media backup destination. Vercel schedules the combined operations endpoint from `vercel.json`.
8. Deploy to Vercel only after integration, browser, restore, and real-device gates pass. The optional `dev:sites` and `build:sites` scripts retain the portable preview path used during initial UI construction.

Supabase uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for browser and user-scoped server clients. Only privileged server code may use `SUPABASE_SECRET_KEY`. Keep real values in ignored environment files and maintain required variable names in `.env.example`.

See the [canonical product and technical plan](docs/product-and-technical-plan.md), [Phase 1 acceptance record](docs/phase-1-acceptance.md), [Phase 2 acceptance record](docs/phase-2-acceptance.md), [Phase 3 acceptance record](docs/phase-3-acceptance.md), [Phase 4 acceptance record](docs/phase-4-acceptance.md), [Phase 5 acceptance record](docs/phase-5-acceptance.md), [Phase 6 acceptance record](docs/phase-6-acceptance.md), [Phase 7 acceptance record](docs/phase-7-acceptance.md), [architecture decisions](docs/adr/README.md), and [production runbook](docs/operations.md).
