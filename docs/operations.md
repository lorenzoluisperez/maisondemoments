# Production runbook

## Release gate

1. `npm run check` and `npm run build` pass from a clean install.
2. Every event and collection preset passes mobile, wide, long-content, reduced-motion, and image-failure visual checks.
3. Ownership, assignment, exact-version approval, payment balance, and publication tests pass against staging PostgreSQL.
4. Household exchange, revoke and reissue, stale RSVP revision, deadline, and CSV formula-escaping browser tests pass.
5. iPhone Safari, Android Chrome, Messenger, and WhatsApp in-app browser tests pass on a constrained network profile.
6. Staging database and media restoration completes in isolation. Deletion records are replayed.
7. Original artwork and every referenced customer media object have a completed off-provider backup before publication.

## Incident actions

- Wrong publication: point the live version to a previously approved compatible version. Preserve RSVP, payment, and audit records.
- Customer removal: set availability to `REMOVED`, increment the access epoch, revoke sessions, stop signed-media delivery, and enqueue deletion work.
- Failed media task: allow the lease to expire, retry within the attempt policy, then surface a persistent staff action.
- Database failure during RSVP: show a retryable error and never display a saved confirmation.
- Artwork CDN failure: preserve text, venue links, navigation, and RSVP controls.

## Retention defaults

| Data | Default |
|---|---|
| Abandoned quarantine upload | 48 hours |
| Rejected unused upload | 7 days |
| Invitation access | Event date plus 90 days |
| Event content, customer media, guest responses | Purge within 30 days after expiry |
| Financial records | Separate accountant-reviewed policy |

Run expiry and deletion as idempotent background jobs. Keep deletion tombstones in a separately protected record so a restoration cannot resurrect removed invitations.

## Database operations

- Use `DATABASE_URL` only with the pooled `maison_app` login. It has DML access through explicit RLS policies and cannot create roles, create databases, replicate, or bypass RLS.
- Use `MIGRATION_DATABASE_URL` only for `npm run db:migrate`, `npm run db:configure-role`, and `npm run db:verify`. Do not add it to the application runtime environment.
- Run `npm run test:db` only against development or staging. It creates isolated fixtures, verifies concurrency and tenant isolation, and removes its rows afterward.
- Run `npm run db:verify` after every schema migration and before deployment.

## Customer brief and studio operations

- Admins create job orders at `/studio/orders/new`. A new customer may be created there without sending an email. The customer then requests an OTP with the same email address. Only the server-side Supabase secret key may create that Auth record.
- The seeded `SEMI_CUSTOM_MVP` package records two revision rounds, 90-day post-event hosting, 12 gallery photos, 500 households, and the balance-before-publication rule. Order creation copies those package terms into an immutable commercial snapshot so later catalog edits cannot alter an existing agreement.

- Customers and admins may edit an order brief. Assigned designers may read customer facts but cannot change them.
- Brief and studio writes include the revision the browser last read. HTTP 409 means another session saved first. Reload the current revision before continuing.
- Brief submission validates all required event facts and attached media, replaces normalized activities, participants, and content in one transaction, then creates or resets the collection-pinned draft.
- A saved brief returns the draft to `EDITING`, clears its submission marker, and increments the draft revision. Staff cannot create a review until the customer resubmits the complete brief.
- Only assigned designers and admins may edit presentation. The API accepts released typography, motion, layout, and existing decorative placement fields. It rejects arbitrary CSS, HTML, scripts, theme changes, new assets, and cross-collection artwork.
- Review states other than `EDITING` and `CHANGES_REQUESTED` lock studio autosave.

## Review and publication operations

- Before creating a review, verify the submitted customer brief, all responsive layouts, keyboard and reduced-motion behavior, and every referenced media object. The studio requires all four QA checks.
- Review creation freezes one validated snapshot with a content hash, renderer compatibility version, source draft revision, media references, and material-change labels. The customer reviews that exact version.
- One review version accepts one decision. Approval and consolidated feedback are mutually exclusive, and only the order owner may record either decision.
- Any customer-content or studio edit increments the aggregate draft revision and invalidates the previous review as a publication candidate. Create and approve a new version.
- Admin publication requires the exact current approved version, a zero outstanding balance, verified off-provider backup for every referenced customer media object, an active unexpired invitation, and matching customer ownership. The database performs these checks while locking the invitation.
- Rollback may target only a previously customer-approved version of the same invitation with a compatible renderer. It changes the live-version pointer without changing responses, payments, or prior audit records.
- Suspension immediately changes availability and increments the access epoch. Resume requires an unexpired invitation with a live version. Expiry is terminal until a future explicit extension workflow is implemented.
- Every review, decision, publication, rollback, suspension, resumption, and expiry writes bounded audit metadata. Reasons are required for availability changes.

## Payments and operations

- Admins record confirmed receipts in the studio payment ledger. Amounts are entered in the displayed currency and stored in minor units. A reference may be used only once for the same order and method.
- Never edit or delete a receipt to correct it. Reverse the original entry with a reason. The database permits one exact reversal and preserves both audit records.
- `/studio/operations` shows work queues, overdue orders, failed durable tasks, media backup state, and email delivery state. Retry a failed task only after correcting its persistent cause.
- Vercel invokes `GET /api/internal/operations` with `Authorization: Bearer <CRON_SECRET>` every five minutes. The route processes bounded batches; cron delivery itself is not the retry mechanism.

## Household access and RSVP operations

- Customers and admins manage households from the selected order in `/portal`. Enter one household or import CSV with the exact columns `household,adults,children,additional_guests`. Separate multiple names with semicolons.
- Each household receives allocated adult, child, and explicit additional-guest slots. Guests cannot add seats. Removing an occupied seat requires an admin response correction first.
- Copying a household link reveals its bearer credential to the authorized host. Anyone with that link has the same household access. Rotate a forwarded link to invalidate its old link and every session from that generation.
- Link exchange stores the guest credential in an HttpOnly, secure production cookie. The invitation fragment is removed from browser history after exchange. Never place private facts in pre-authentication metadata.
- RSVP submissions require the live invitation version, the browser's current response revision, and a unique idempotency key. HTTP 409 requires a reload before retrying with changed data.
- Guest writes close after the event-local RSVP deadline. Admins may record a correction with a reason after the deadline. Every correction remains in audit history.
- CSV response exports prefix spreadsheet-formula characters before quoting cells. Keep exports private and do not grant designers unrestricted guest-list access.
- Delete expired rate-limit rows during Phase 7 cleanup. Alert on repeated exchange failures and RSVP errors without logging tokens, cookies, names, notes, or request bodies.

## Media operations

- Run `npm run storage:setup` once per environment and after changing bucket policy. Both `maison-quarantine` and `maison-private-media` must remain private.
- Run `npm run catalog:seed` after migrations and whenever a released catalog definition is added. Never change bytes at an existing released artwork path.
- Run `npm run media:verify` before deployment to verify private buckets and released catalog records.
- `POST /api/internal/media-jobs` remains available for a manual media-only run with `BACKGROUND_JOB_SECRET`. Normal production processing uses the combined protected operations cron.
- Use `npm run media:work` for a manual bounded worker and cleanup pass in development or staging.
- Alert on `FAILED` media jobs, `REJECTED` media objects, growing pending-job age, and ready media with a retained quarantine key.
- Signed private delivery URLs expire after five minutes. Delivered objects use a five-minute browser cache. Immediate removal requires deleting the object and allowing for CDN invalidation propagation.
- Recipe changes require a new recipe version and new object paths. Never overwrite an existing derivative path.

## Backup, retention, and restoration

- Configure `BACKUP_S3_*` against storage owned independently from the primary Supabase project. Publication remains blocked until every referenced customer media object reports `VERIFIED`.
- Expiry and removal revoke guest links and sessions immediately. Expiry schedules purge after 30 days; removal schedules it immediately. The purge exports its tombstone before personal data is destroyed.
- Backup deletion uses the recorded media prefix, then primary-media cleanup removes Supabase originals and variants. Deletion tombstones remain in the independent destination for restoration replay.
- Enable Supabase PITR in production. Database backup does not cover Storage objects, so keep PITR and media backup as separate controls.
- Set `RESTORE_DATABASE_URL` to a disposable database that is different from production, install `pg_dump` and `pg_restore`, then run `CONFIRM_RESTORE_DRILL=RESTORE_DISPOSABLE_DATABASE npm run ops:restore-drill`.
- Never direct the restoration command at an active environment. The script deliberately refuses an identical source and target and requires the confirmation phrase.
# Wedding commerce rollout, added 2026-09-28

Keep `COMMERCE_CHECKOUT_ENABLED=false` and new product offers disabled until this sequence passes on a staging database. Apply reviewed migrations 0020 through 0024 before exposing the new routes. Configure the Supabase email OTP template to show `{{ .Token }}` and verify expiry, resend, sign-in, and staff TOTP enrollment. Set `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` from the same test-mode PayMongo account, register `/api/webhooks/paymongo` for `checkout_session.payment.paid`, and set immutable versioned HTTPS service-terms and cancellation-policy URLs, tax notice, and `NEXT_PUBLIC_APP_URL`. The aggregate, content-free funnel requires `COMMERCE_ANALYTICS_ENABLED=true`; check its legal notice and reporting behavior before enabling it. In staging, set that flag and `COMMERCE_CHECKOUT_ENABLED=true` to run test purchases, then enable one Essential offer only after its price, delivery time, and booking capacity are checked by an admin. Keep the production checkout setting false until every launch gate is evidenced.

Run a real PayMongo test-mode purchase for each design. Confirm that the success redirect alone leaves the purchase pending, the signed webhook settles exactly once, the paid customer can complete a brief, the order ledger records one provider receipt, and studio, review, and private guest views use the purchased renderer. Repeat with a duplicate webhook, a delayed webhook, a failed attempt followed by retry, and a missed webhook recovered by the authenticated operations cron. Inspect unresolved `CREATING` and `OPEN` checkout attempts in `/admin` and PayMongo before manual intervention. A PayMongo Checkout Session does not expire automatically; do not treat the customer cancel redirect as a provider cancellation.

For a full refund, issue it in the PayMongo dashboard and copy its `ref_` ID. In `/admin`, enter that ID against the purchase and use **Verify refund**. The server retrieves the refund using the configured secret key and records it only when PayMongo reports `succeeded` for the exact payment, full amount, PHP currency, and merchant mode. For an order already created, this writes one append-only negative ledger entry tied to the original receipt. A live invitation is suspended and its existing guest sessions are invalidated. The customer payment confirmation then shows the refunded state. Retrying the same confirmation is safe. A pending, failed, partial, wrong-payment, or wrong-mode refund is rejected for staff review. Do not use a manual bookkeeping reversal to claim money was returned. The provider's `succeeded` status means the refund was sent to the payment partner; the customer's account may reflect it later. Automated refund discovery and partial-refund accounting remain launch work. Manual payment entry is blocked for product orders; provider receipts must come from confirmed PayMongo state. Keep live offers disabled until the merchant, legal, tax, backup, music, and physical-device gates in the product plan are evidenced.

Admins record production minutes and actual PHP costs against each paid purchase in `/admin`. Include labor, commissioned artwork, provider fees, and other direct costs. An incorrect entry is voided with a reason; the row and audit trail remain. The 30-day tier report subtracts only recorded costs and treats a fully refunded purchase as zero revenue. Label it as recorded contribution, not final accounting margin, until all direct costs and applicable taxes are entered and reconciled.
