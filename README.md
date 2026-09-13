# Maison de Moments

Designer-operated software for producing premium interactive invitations. The first release supports weddings, birthdays, debuts, and christenings across two versioned artwork collections.

## Implemented foundation

- Eight event and collection presets with one semantic, naturally scrollable, reduced-motion-aware renderer
- Always-available Details and RSVP controls, long participant-list handling, and synthetic public demos
- Customer content portal and constrained production studio prototypes
- Strict Zod event, invitation, upload, and RSVP contracts
- PostgreSQL schema for accounts, orders, catalog, immutable versions, reviews, households, seats, payments, audit history, and durable tasks
- Persistent account and order APIs with Supabase Auth session verification and normalized event storage
- Private signed media uploads, durable Sharp processing, immutable responsive variants, authorized delivery, and cleanup
- Persistent artwork collections, typed asset metadata, immutable theme versions, and stable renderer asset bindings
- Least-privilege pooled database runtime, locked Data API tables, RLS, and repeatable database verification
- Transaction-safe JO allocation, exact-version publication gate, immutable version trigger, and leased task claiming
- Role checks for customers, assigned designers, and admins
- 256-bit household token generation, keyed digest lookup, encrypted reissue storage, and timing-safe comparison
- Domain and database integration tests for event types, snapshots, permissions, tenant isolation, JO concurrency, RSVP rules, and credentials

The visible portal, studio, and RSVP interactions still use synthetic in-browser data. Persistent account, order, and media APIs now exist behind `/api/account`, `/api/orders`, and `/api/media`; connecting them to customer forms belongs to the production slice in Phase 4.

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

Run validation:

```bash
npm run check
npm run test:db
npm run db:verify
npm run media:verify
npm run db:generate
npm run build
npm run guest:verify
```

## Production setup

1. Create separate Supabase projects for staging and production.
2. Set the pooled `DATABASE_URL` for `maison_app` and the privileged, session-pooled `MIGRATION_DATABASE_URL` only in migration environments.
3. Run `npm run db:migrate`, `npm run db:configure-role`, and `npm run db:verify` through the migration environment.
4. Run `npm run storage:setup`, `npm run catalog:seed`, and `npm run media:verify` from a trusted server environment.
5. Configure the remaining values documented in `.env.example`. Never expose the Supabase secret key, background-job secret, guest-token secrets, or database URLs to the browser.
6. Enable Supabase email OTP for customers and MFA-enforced staff sign-in.
7. Schedule the protected media-job endpoint, then configure Resend, Sentry with personal-content redaction, PITR, and a separate media backup destination.
8. Deploy to Vercel only after integration, browser, restore, and real-device gates pass. The optional `dev:sites` and `build:sites` scripts retain the portable preview path used during initial UI construction.

Supabase uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for browser and user-scoped server clients. Only privileged server code may use `SUPABASE_SECRET_KEY`. Keep real values in ignored environment files and maintain required variable names in `.env.example`.

See the [canonical product and technical plan](docs/product-and-technical-plan.md), [Phase 1 acceptance record](docs/phase-1-acceptance.md), [Phase 2 acceptance record](docs/phase-2-acceptance.md), [Phase 3 acceptance record](docs/phase-3-acceptance.md), [architecture decisions](docs/adr/README.md), and [production runbook](docs/operations.md).
