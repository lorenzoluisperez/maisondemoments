# Phase 6 guests and RSVP acceptance

## Household management

- Customers and admins can add one household or import up to 500 households from bounded CSV. Each household has ordered adult and child slots, with additional guests represented as explicit allocated slots.
- Household edits use revision checks. Occupied slots cannot be removed until an admin corrects the response. Deactivated households lose guest access.
- Hosts can copy, rotate, revoke, and reissue credentials. Rotation and revocation invalidate every prior session for that household.

## Private guest access

- Each household link contains a 256-bit token in the URL fragment. The server stores a keyed digest for lookup and an authenticated encrypted copy for host reissue.
- Same-origin exchange creates an HttpOnly session cookie and removes the fragment from browser history. Reopening and forwarded links create independent sessions for the same household.
- Every guest read verifies the live immutable version, invitation availability and expiry, access epoch, active household, current link generation, and session expiry. Pre-authentication pages contain generic branding only.
- Private customer media receives short-lived signed URLs only after guest authorization. Guest responses use private no-store API responses.

## RSVP integrity

- Server validation restricts responses to allocated household slots. Attending requires a selected seat, declining requires none, and an unnamed adult seat requires a supplied guest name.
- Writes enforce the event-local deadline, current invitation version, optimistic response revision, and idempotency key. Repeated delivery of one successful request does not create a new revision.
- PostgreSQL rejects an RSVP attendee whose slot belongs to another household. Per-minute keyed rate limits bound link exchange, invitation reads, and RSVP writes.
- Admin correction requires a reason and remains in audit history. Totals derive from active households, slots, and current responses.
- CSV export quotes every cell and neutralizes spreadsheet-formula prefixes.

## Order and session usability

- Admins can create a customer account and complete a validated job order through `/studio/orders/new`, including a package-terms snapshot, assignment, event baseline, collection, quote, deposit, and due date.
- The customer Auth identity is created with the server-only Supabase secret. No invitation email is sent automatically. The customer signs in through email OTP.
- The migration seeds the initial `SEMI_CUSTOM_MVP` package so a configured environment has an available package without manual SQL.
- Private portal and studio navigation includes sign-out and returns the user to `/login`.

## Verified gates

- 38 domain tests pass, including guest-session token separation, household CSV parsing, spreadsheet safety, seat rules, deadlines, and strict request contracts.
- 22 live PostgreSQL and Storage integration tests pass. Three exercise the Phase 6 lifecycle: forwarding, session exchange, RSVP submission and replay, stale writes, occupied slots, cross-household guards, correction, export, rotation, and revocation.
- Database verification reports 33 RLS-enabled application tables, 15 applied migrations, no browser-role table grants, no public function grants, and no missing foreign-key indexes.
- Supabase security advisors report one password-leak-protection warning. The MVP uses email OTP rather than passwords, so this does not affect the active sign-in path. Reassess it before enabling password authentication. Performance advisors report only expected unused-index notices on the new and lightly exercised development schema.
- Lint, TypeScript, media verification, production build, and guest performance budgets pass through `npm run check:full`.

## Remaining release gate

Physical iPhone Safari, lower-powered Android Chrome, Messenger, and WhatsApp in-app browser checks remain part of the Phase 1 release gate. Phase 6 does not claim those device results.
