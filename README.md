# Maison de Moments

Designer-operated software for producing premium interactive invitations. The first release supports weddings, birthdays, debuts, and christenings across two versioned artwork collections.

## Implemented foundation

- Eight event and collection presets with one semantic, naturally scrollable, reduced-motion-aware renderer
- Always-available Details and RSVP controls, long participant-list handling, and synthetic public demos
- Customer content portal and constrained production studio prototypes
- Strict Zod event, invitation, upload, and RSVP contracts
- PostgreSQL schema for accounts, orders, catalog, immutable versions, reviews, households, seats, payments, audit history, and durable tasks
- Transaction-safe JO allocation, exact-version publication gate, immutable version trigger, and leased task claiming
- Role checks for customers, assigned designers, and admins
- 256-bit household token generation, keyed digest lookup, encrypted reissue storage, and timing-safe comparison
- Domain tests for all event types, deterministic snapshots, permissions, transitions, RSVP seats/deadlines, and credentials

The current portal, studio, and RSVP interactions use synthetic in-browser data. This keeps the experience reviewable without pretending production authentication, storage, email, or payment confirmation is configured.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env.local
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
npm run db:generate
npm run build
```

## Production setup

1. Create separate Supabase projects for staging and production.
2. Apply `drizzle/0000_flawless_jack_flag.sql`, then `drizzle/0001_domain_functions.sql` with a migration-only database role.
3. Configure the values documented in `.env.example`. Never expose the service-role key, guest-token secrets, or database URL to the browser.
4. Add Supabase email OTP for customers and MFA-enforced staff sign-in.
5. Implement server adapters behind the existing domain contracts. Every handler must load the actor server-side and call the role and ownership checks.
6. Create private quarantine and customer-media buckets. Process uploads with Sharp under the limits in `lib/media/policy.ts`.
7. Configure Resend, Sentry with personal-content redaction, scheduled bounded task claims, PITR, and a separate media backup destination.
8. Deploy to Vercel only after integration, browser, restore, and real-device gates pass. The optional `dev:sites` and `build:sites` scripts retain the portable preview path used during initial UI construction.

Supabase uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for browser and user-scoped server clients. Only privileged server code may use `SUPABASE_SECRET_KEY`. Keep real values in ignored environment files and maintain required variable names in `.env.example`.

See the [Phase 1 acceptance record](docs/phase-1-acceptance.md), [architecture decisions](docs/adr/README.md), and [production runbook](docs/operations.md).
