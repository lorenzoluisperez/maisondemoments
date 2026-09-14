# Phase 7 operational hardening acceptance

## Implemented controls

- Admins can record confirmed manual payments in integer minor units and reverse one original receipt exactly once. Every operation is idempotent, append-only, currency checked, balance bounded, and audited.
- The studio exposes an admin operations dashboard for production queues, overdue work, backup state, email state, and failed durable tasks. Failed tasks can be reset through an audited admin action.
- Customer navigation hides staff-only production and order controls after the authenticated role loads.
- Frozen reviews and initial publication enqueue fixed transactional messages. The email worker uses provider idempotency keys and never accepts customer-authored HTML.
- Ready customer media automatically enters an off-provider S3-compatible backup queue. Each immutable object is uploaded with a checksum, read back through object metadata, and recorded as verified.
- PostgreSQL blocks publication when a referenced non-catalog media object lacks a verified backup.
- Expiry revokes guest links and sessions, creates a durable deletion record, and schedules personal-content purge after 30 days. Removal revokes access immediately and schedules immediate purge.
- Purge exports a deletion tombstone to the independent backup destination before deleting event facts, guest records, reviews, notifications, and primary and backup media. Financial entries and a minimal closed order remain under their separate retention policy.
- A protected Vercel cron invokes bounded media, backup, email, retention, and cleanup work. PostgreSQL leases and retries remain the durability layer if an invocation fails.
- Structured operational logs include run IDs and durations without request bodies or private content. Server and edge exceptions are sent to Sentry with default PII collection disabled and request metadata reduced to method and URL.
- The guarded restoration script requires a different disposable database, PostgreSQL client tools, an explicit confirmation phrase, and the off-provider deletion tombstone archive. It restores the database, reapplies removals, and checks that purged invitations were not resurrected.

## Verified gates

- 38 domain tests pass.
- Phase 7 payment integration tests prove admin-only access, idempotent recording, derived balances, exact reversal, and duplicate-reversal rejection.
- Database verification reports 36 RLS-enabled application tables, 20 applied migrations, no browser-role table grants, no public function grants, and no missing foreign-key indexes.
- Lint, TypeScript, production build, media verification, and guest bundle budgets are part of the full release check.

## Infrastructure gate still required

The repository does not contain production credentials. Before a pilot, configure `CRON_SECRET`, `EMAIL_FROM`, the five `BACKUP_S3_*` values, Supabase production PITR, and a disposable `RESTORE_DATABASE_URL`. Install PostgreSQL client tools and run:

```bash
CONFIRM_RESTORE_DRILL=RESTORE_DISPOSABLE_DATABASE npm run ops:restore-drill
```

A successful command must report `restored: true`, at least 36 public tables, the number of replayed tombstones, and zero purged-invitation violations. Record the dated output in the operational change log. This gate cannot be claimed from local code tests alone.

The Phase 1 physical iPhone, lower-powered Android, Messenger, and WhatsApp checks also remain open.
