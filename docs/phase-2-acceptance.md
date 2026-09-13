# Phase 2 domain-foundation acceptance

## Implemented foundation

- All four event types pass strict, discriminated Zod schemas before persistence.
- Supabase Auth sessions are refreshed through the Next.js proxy and verified with `getClaims()` before application authorization.
- Authenticated users can idempotently provision one customer account. Staff roles remain database-controlled.
- Admins can create a job order and normalized event in one short database transaction.
- Customers can read only their own orders. Designers can read only assigned orders. Admins can read every order.
- JO numbers come from a transaction-safe PostgreSQL allocator.
- Order reads reconstruct and validate the event from normalized activities, participants, bounded details, and content modules.
- API mutations require same-origin JSON requests and enforce a 128 KiB body limit.

## Database controls

- Runtime traffic uses the pooled, non-superuser `maison_app` role.
- Migrations use a separate privileged connection that is excluded from application runtime configuration.
- All 30 application tables have RLS enabled.
- The `anon` and `authenticated` roles have no table grants for the application schema.
- The publishable key cannot query raw application tables.
- Application functions are not executable by public browser roles.
- Every foreign-key column has a supporting index.
- Invitation-version immutability and transaction-safe JO allocation are enforced in PostgreSQL.

## Verified gates

- Unit suite passes independently of external services.
- Database integration tests create and clean isolated fixtures on the configured Supabase project.
- Integration coverage proves account provisioning, normalized order persistence, owner and assignment isolation, concurrent JO allocation, and denial of publishable-key table access.
- `npm run db:verify` confirms migrations, runtime-role privileges, RLS coverage, browser grants, function grants, and foreign-key indexes.
- The production Next.js build succeeds with the authenticated API and proxy routes.

Phase 2 is complete when `npm run check`, `npm run test:db`, `npm run db:verify`, and `npm run build` all pass against the target development or staging Supabase project.
