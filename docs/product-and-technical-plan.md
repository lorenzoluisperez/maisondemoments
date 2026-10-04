# Maison de Moments product and technical plan

Status: active source of truth

Last updated: 2026-10-04

This document records the agreed product direction, architecture, release boundaries, implementation phases, and current status. Update it whenever scope, architecture, or phase status changes.

## Current public release

The site is a viewing-only showcase for Garden Romance, Coastal Romance, Heritage Romance, Pearl & Poise, and Eighteen in Wonderland. The first three form the wedding collection; the latter two form Debuts / 18th Birthdays. Visitors can browse `/`, `/designs`, individual design pages, and the fictional `/demo` previews. `/how-to-order` explains the message-based process: choose a design, send the design name plus event date and location on Facebook or Instagram, then discuss availability, scope, pricing, and next steps with the team. The social icons remain visibly labeled placeholders until `FACEBOOK_PAGE_URL` and `INSTAGRAM_PROFILE_URL` contain real HTTPS profile URLs. Do not rely on the site for orders until at least one real contact link is configured and checked.

There is no online ordering, payment, quote submission, or portal in this release. Public pages do not show checkout or sign-in entry points. Direct checkout, quote, login, customer, admin, studio, and review pages redirect to `/how-to-order`. `showcaseOnly` in `lib/site-mode.ts` keeps purchase creation, checkout session creation, quote requests, and offer enablement closed even if checkout environment variables are set. Leave `COMMERCE_CHECKOUT_ENABLED=false` in every deployed environment. The historical private foundation remains in the codebase but is not part of the public promise.

The existing PayMongo, portal, studio, review, publication, guest, media, and operational work is deferred, not accepted for live use. Preserve earlier orders and the eight legacy presets. Previous local implementation and test evidence does not establish provider integration, release readiness, or the quality of a real-device guest experience. The older Phase 1 through 7 acceptance records describe legacy foundation only; [phase-commerce-acceptance.md](phase-commerce-acceptance.md) records deferred commerce evidence and open gates.

Current release checks: social URLs point to the intended accounts; the order steps are readable on mobile and desktop; every public design leads to the ordering guide; old checkout and customer portal URLs lead to the guide; no request can create a checkout session while showcase mode is active. Check the five demos separately for visual quality and guest interaction before promotion.

Pearl & Poise is a dedicated synthetic showcase at `/demo/debut-pearl`, with a listing at `/designs/pearl-and-poise`. Its stationery-first presentation uses realistic blush cotton-paper envelopes, a dimensional pearl seal, and hand-painted watercolor-style ornaments. Separate portrait and landscape envelope compositions fill the screen edge to edge with uniform scaling and edge cropping, so holding a phone feels like holding the envelope. The coordinated ivory, blush, champagne, and dark-ink palette keeps decoration subordinate to readable content. It includes a gently paced pearl-sealed opening, optional guest-initiated piano music with play/mute and visible attribution, program, dress code, countdown, four groups of 18 fictional names (Roses, Candles, Treasures, and Blue Bills), and a demonstration RSVP that submits nothing. Public discovery is independent of the dormant wedding commerce catalog. No database migration, customer editor, new payment capability, or private-delivery integration accompanies this design. See [debut showcase assets and verification](debut-pearl-showcase-assets.md). General birthday and christening showcases remain future work.

Eighteen in Wonderland adds a separate synthetic showcase at `/demo/debut-wonderland` and listing at `/designs/eighteen-in-wonderland`. A powder-blue bookcloth cover and realistic engraved brass keyhole lead through watercolor paper layers into a tea garden. The key seats, turns, and withdraws; the garden and unfolded flower/tea pieces remain mounted through the introduction and formal invitation. Illustrated storybook spreads contain the program, attire, countdown, 18 Roses, Candles, Treasures, and Blue Bills (all 72 fictional names), pocket-watch Details on an opaque paper card, a Cheshire Cat surprise, and a sample RSVP. The existing debut fixture contract, licensed gesture-initiated piano, and public catalog are reused; no new commerce, editing, database, or private-delivery capability is introduced. See [Wonderland assets and verification](debut-wonderland-showcase-assets.md).

The remaining sections document deferred platform architecture and earlier implementation evidence. They do not define active customer-facing features or purchase terms for the showcase.

## Deferred commercial wedding release

The following decisions and architecture describe a possible later online-commerce phase. They are not requirements or active purchase terms for the current viewing-only release. Reconfirm price, service scope, legal terms, workflow, and readiness before restarting this phase.

- One Next.js application and deployment. Public routes are `/` and `/designs`; customers use `/portal`, staff use `/admin` and `/studio`, and guests use private `/i/[slug]` links.
- Three released wedding designs, each preserving its artwork and opening sequence. Future birthday, debut, and christening products are not on sale yet.
- Essential includes structured facts, wording, names, initials, and supported photos with the original styling. Signature adds curated staff-controlled options. Couture requires a scoped immutable proposal with deliverables, exclusions, revision allowance, price, and delivery time before payment.
- Essential and Signature have separate per-design PHP prices, full payment, two consolidated discretionary revision rounds, 12 photos, 500 households, and hosting through 90 days after the event. Factual corrections and staff defects do not use a revision round. Couture terms are snapshotted from the accepted proposal.
- Customers sign in with email codes; staff also require TOTP MFA. Hosted PayMongo checkout in PHP is the first provider. Do not show converted currencies until settlement in those currencies is supported. Stripe is deferred.
- A purchase can exist without a complete event brief. Verified payment precedes detailed content collection. Browser redirects never settle payment. Signed provider events or provider API reconciliation do. The existing append-only order ledger remains authoritative after intake.
- Server permissions protect prices, quote acceptance, order ownership, designer assignment, review approval, payment history, publication, guest seats, and media. Customer-authored HTML, CSS, and scripts are not supported.

## Deferred delivery sequence and acceptance

1. Complete the product renderer and content capabilities with exact-version snapshots and legacy compatibility.
2. Complete test-mode storefront purchasing, email authentication, PayMongo confirmation, retries, reconciliation, and Couture acceptance.
3. Complete the portal production timeline, provider-confirmed refunds, visual-fit tooling, business analytics, and admin exception queues.
4. Validate complete purchase-to-publication journeys for all three designs on staging, then perform payment recovery and physical-device review before controlled live enablement.

Required checks include authentication expiry and cross-account access, staff MFA, duplicate and delayed payment events, refund confirmation, quote immutability, tier restrictions, long and missing content, mobile and reduced motion, revoked household links, RSVP deadlines, concurrent edits, `npm run check`, production build, focused browser tests, and staging database integration tests. Track product view, checkout, paid order, production hours, revisions, delivery time, refunds, and margin by tier without sending private invitation facts or guest tokens to analytics.

## Product definition

Maison de Moments is a designer-operated service for producing premium interactive invitations from structured customer information and reusable original artwork.

The product serves three audiences:

- Customers receive a distinctive invitation, a clear content and review process, and guest-response management.
- Guests receive an emotional introduction followed by dependable access to event details and RSVP.
- Staff receive a production system that prevents retyping customer facts, controls publication, and makes workload visible.

The initial business is a productized creative service. Customers buy a finished invitation and a defined hosting period. A future self-service product may reuse the platform, but self-service must not shape the first release.

## Deferred online-commerce decisions

These are prior online-commerce design decisions, retained for possible future work and subject to review before activation. The underlying four event schemas, two artwork collections, eight presets, and historical orders remain supported for compatibility. The current site accepts inquiries for three wedding designs and two debut showcases through social messaging only.

## Roles and permissions

| Role | Allowed responsibilities |
|---|---|
| Customer | Manage owned orders, submit content and media, manage households, review versions, request revisions, approve, and view or export RSVPs. |
| Designer | Work only on assigned orders, inspect production content, configure supported layouts, prepare review versions, and complete internal QA. |
| Admin | Assign work, manage catalog and prices, confirm payments, publish, rollback, suspend, correct operational data, and manage access. |
| Guest | View one authorized household invitation and manage that household's response. |

Staff accounts require MFA. Designers do not need unrestricted payment details or guest-list exports. Customer approval applies to one immutable version.

## Deferred online-commerce workflow

1. The customer browses three wedding products, previews a fictional example, and selects a design and tier.
2. Essential and Signature customers verify email, provide booking date and contact details, accept displayed terms, and pay in PHP via hosted checkout. Couture customers request a scoped proposal and accept its exact terms first.
3. A signed PayMongo event or authorized reconciliation confirms the purchase. The customer completes the wedding brief in the portal, including supported photos after the production order is created.
4. A designer reviews the selected design with customer facts, resolves content fit, and releases an immutable review version. The customer approves that exact version or requests a permitted revision.
5. An admin publishes only after the current approval, financial balance, and referenced-media backup gates pass. The customer manages private household links and guest replies.
6. Corrections after approval start a new review cycle. Expiry and retention follow the purchased terms and existing protected workflows.

Turnaround begins after verified payment and a complete brief. Customer delays pause production timing.

## Architecture baseline for deferred private workflows

- One TypeScript and Next.js repository and deployable application.
- Supabase PostgreSQL, Auth, and Storage.
- Drizzle with reviewed SQL migrations.
- Zod contracts and React Hook Form for bounded forms.
- A shared semantic invitation renderer for studio preview, customer review, and guest delivery.
- CSS for ordinary transitions and GSAP core for controlled scene sequences.
- Sharp for bounded image processing.
- PostgreSQL-backed durable jobs until measured scale justifies a dedicated queue.
- Resend for transactional email and Sentry plus structured logs for diagnostics.
- PostgreSQL PITR plus separate protected media backups.

Domain logic must not depend on React or Next.js. Renderer code must not query the database. Guest bundles must not import studio controls. Infrastructure adapters must not define product policy.

## Core domain model

- Accounts control customer ownership and staff permissions.
- Job Orders hold commercial terms, assignment, deadlines, and production state.
- Events hold factual content, activities, participants, and media references.
- Catalog holds collections, artwork, themes, and immutable theme versions.
- Invitations have one mutable draft and many immutable versions.
- Reviews bind feedback and approval to an exact version.
- Guest groups own allocated slots, credentials, sessions, and responses.
- Payments are append-only entries and reversals from which balance is derived.
- Operations include audit history, durable jobs, retention, and deletion work.

Do not join people by name. An event participant is not automatically a guest. The person paying is not assumed to be a celebrant.

Normalize ownership, authorization, joins, money, scheduling, and operational state. Use validated, versioned JSON only for bounded event-specific details, module content, theme defaults, designer configuration, and immutable snapshots.

## Data invariants

- UUIDs are internal identifiers. JO numbers are separate unique business identifiers.
- JO allocation uses a transaction-safe yearly counter.
- Monetary values use integer minor units and ISO currency codes.
- Event times preserve an IANA timezone.
- Stable invitation slugs are never assigned to another customer.
- Content and media references cannot cross customer ownership boundaries.
- Approved and published versions are immutable.
- Every draft-dependent change increments the aggregate revision.
- Occupied guest slots cannot be removed without explicitly correcting the response.
- Guests cannot create more slots than the household allocation.
- Public endpoints obtain household identity from the verified server session, never from a submitted household ID.

## Theme and rendering model

Keep these concepts separate:

- Artwork collection: coordinated illustrations and textures.
- Theme version: immutable typography, colors, assets, supported layouts, and defaults.
- Event preset: modules, labels, and initial arrangements for an event type.
- Scene: one stage of the guest journey containing one or more modules.
- Module: semantic content such as schedule, dress code, or RSVP.
- Layout variant: a supported module arrangement.
- Interaction preset: developer-authored behavior such as opening or unfolding.
- Designer override: bounded presentation data.
- Event data: customer facts independent of presentation.

Override resolution is `theme defaults -> event preset -> designer overrides`. Customer facts bind separately and cannot be replaced through decorative overrides.

Allow controlled tokens, typography presets, placement, visibility, supported variants, and animation intensity. Reject arbitrary HTML, CSS, JavaScript, external scripts, component nesting, and executable expression languages.

The renderer must produce semantic HTML, accessible controls, responsive content, decorative artwork layers, a small scene controller, and approved motion. Animation is progressive enhancement. Event details and RSVP remain usable when motion fails or reduced motion is enabled.

## Publishing model

Published invitations render from immutable database snapshots using pinned theme and renderer compatibility versions. They never render from mutable event tables and do not require a deployment per customer.

Publication captures one consistent draft revision, validates it, resolves a snapshot, creates a content hash, records exact approval, and transactionally updates the live-version pointer with an audit event.

Rollback changes only the live-version pointer. It does not roll back guest responses, payments, access revocations, or audit history.

## Household access and RSVP

Each household receives one 256-bit bearer credential. The token is exchanged through a same-origin POST for an HttpOnly session and then removed from the visible URL. Only a digest is used for lookup. Reissuable token material is encrypted under a separately managed server key.

A forwarded link grants the recipient the same household access. Hosts must be told this. The MVP remedy is revocation and reissue.

Guest slots are the authoritative seat allowance. Plus-ones and children require allocated slots. Attending requires at least one selected slot. Declining selects none. Responses use idempotency keys and revision checks and may be amended until the server-enforced deadline.

## Media model

Customer media flows through private quarantine storage:

1. The authenticated customer requests an upload intent.
2. The server validates ownership, type, and quota.
3. The browser uploads directly to a private quarantine path.
4. Finalization verifies the object and enqueues durable processing.
5. The worker validates bytes, detected type, dimensions, and decoder limits.
6. It strips metadata, normalizes orientation and color, and writes immutable responsive derivatives.
7. Valid derivatives become selectable. Failures remain visible and actionable.

Initial inputs are JPEG, PNG, and WebP, up to 25 MB and 50 megapixels. Reject malformed and animated images. Provide a clear conversion path for HEIC instead of processing it during MVP.

Reusable catalog artwork and web-licensed fonts may use the public CDN. Customer photos, exclusive artwork, source files, snapshots, and originals stay private. Published object keys are immutable.

## Performance and accessibility budgets

| Area | Initial target |
|---|---|
| First usable guest JavaScript | At most 200 KiB compressed, including framework code |
| Critical visual assets | At most 300 KiB combined |
| Total critical transfer | At most 600 KiB |
| Web fonts | At most two families and 100 KiB combined |
| Main journey excluding optional gallery and audio | Target at most 2 MB |
| Active moving layers | Target no more than eight |
| Active and adjacent decoded image memory | Target at most 64 MB |

Field targets are p75 LCP at or below 2.5 seconds, INP at or below 200 milliseconds, and CLS at or below 0.1. Under approximately 1.6 Mbps, 300 ms latency, and slowed CPU, useful event information should appear within five seconds without an animation gate.

Use semantic forms and navigation, keyboard equivalents, safe-area handling, text zoom support, reduced motion, and ordinary document scrolling. Preload only critical scene media and progressively load the next scene.

## Security and privacy baseline

- Enforce ownership and staff assignment on every server read, mutation, upload, and export.
- Keep database, secret API, guest-token, and encryption credentials server-only.
- Deny browser database roles access to private application tables and storage paths.
- Render plain text or constrained structured content to prevent stored XSS.
- Allow only approved URL schemes and never fetch arbitrary customer URLs automatically.
- Quarantine and validate uploads with quotas and decoder limits.
- Protect mutations with secure cookies, SameSite policy, Origin checks, and CSRF controls.
- Throttle credential exchange and RSVP writes with bounded payloads.
- Use private, no-store responses for personalized content.
- Escape spreadsheet-formula prefixes in exports.
- Disable advertising trackers and session replay on private invitations.
- Collect only the personal information required for the service.

Proposed retention defaults are 48 hours for abandoned quarantine uploads, seven days for rejected unused uploads, invitation access through the event plus 90 days, and personal content removal within 30 days after expiry. Financial retention requires separate accountant and legal review. Restores must replay deletion records.

## State machines

- Production: `NEW -> COLLECTING -> READY -> IN_PRODUCTION -> DELIVERED -> CLOSED`.
- Review: `EDITING -> IN_REVIEW -> APPROVED`, or `IN_REVIEW -> CHANGES_REQUESTED -> EDITING`.
- Availability: `UNPUBLISHED -> LIVE <-> SUSPENDED`, followed by `EXPIRED` or terminal removal.
- RSVP: `NO_RESPONSE -> ATTENDING | DECLINED`, amendable until the deadline.

Payment state is derived separately from confirmed entries and reversals. Do not overload one status with production, review, payment, and availability conditions.

## Phase 3: implementation record

Phase 3 completed the production media and renderer layer using the existing renderer proof and artwork as its starting point.

### Delivered

1. Define storage buckets, object-path rules, quotas, and customer ownership checks.
2. Implement upload intent and finalization APIs using the current Supabase keys and private storage.
3. Add byte, MIME, dimension, pixel-count, animation, and malformed-image validation.
4. Process images through bounded Sharp jobs with retries and idempotency.
5. Generate immutable responsive WebP derivatives and record processing recipe versions.
6. Persist media objects, variants, artwork metadata, collection membership, rights scope, dimensions, bounds, anchors, and tags.
7. Resolve published renderer assets by stable identifiers without storing expiring URLs in snapshots.
8. Ensure customer and exclusive media uses authorized short-lived delivery URLs.
9. Exercise every event and collection preset with short, long, missing, portrait, landscape, reduced-motion, and image-failure fixtures.
10. Add media cleanup, retry visibility, and reference-integrity tests.
11. Record measured transfer, decoded-memory, and interaction results against the stated budgets.
12. Update `.env.example`, operations documentation, ADRs, and the phase status in this file.

### Exit evidence

An authorized customer image now travels from direct private upload through durable validation and derivative generation into the shared renderer. All eight presets bind released artwork and pass edge-case and budget checks. PostgreSQL rejects cross-customer references and deletion of referenced media. Processing, cleanup, and bounded-retry integration tests pass against the configured Supabase project.

The physical-device gate remains separate and still requires real target devices and relevant in-app browsers.

## Phase 4: implementation record

Phase 4 completed the production path from customer facts to a designer-editable invitation draft.

### Delivered

1. Persist versioned, incomplete customer briefs for all four event types without weakening the normalized event model used after submission.
2. Provide an authenticated customer workspace for identity, schedule, participants, wording, and up to 12 ready photographs.
3. Save customer changes incrementally with aggregate revisions and reject stale writes with a reload path.
4. Validate submission with section-specific issues, verify attached media readiness, and normalize the accepted brief into event tables.
5. Generate one stable invitation and a released, collection-pinned draft without copying customer facts into designer text overrides.
6. Provide a staff queue and assigned-order studio using the same invitation renderer as the guest experience.
7. Save typography, motion, scene layout, and decorative placement through a strict allowlist with revision conflicts, session undo/redo, mobile and wide preview, and review-state locking.
8. Keep customers from editing presentation and designers from changing customer content, theme versions, or cross-collection artwork.

### Exit evidence

All four event types round-trip between normalized event data and editable briefs. Live PostgreSQL tests prove customer ownership, designer assignment, stale-write rejection, automatic draft generation, normalized submission, and bounded studio updates. The shared renderer visibly applies all allowed studio controls. A designer can work from customer-submitted facts without retyping names, dates, venues, participant lists, wording, or media references.

The order-creation API currently starts from a valid event baseline. It remains an admin workflow, while customers can clear, revise, and resubmit the editable brief. A future sales-intake workflow may create a less complete shell if operational evidence shows that is needed.

## Phase 5: implementation record

Phase 5 completed the controlled path from a mutable production draft to an immutable approved and published invitation.

### Delivered

1. Freeze a submitted, complete, current draft only after staff completes the internal QA checklist.
2. Store immutable, schema-validated snapshots with deterministic hashes, source revisions, renderer compatibility, material-change labels, and retained media references.
3. Give the customer a dedicated frozen review with one exact-version approval or one consolidated change request.
4. Invalidate pending and approved review candidates when customer facts or designer presentation change.
5. Require an admin, exact current customer approval, full confirmed balance, active hosting period, and invitation ownership before publication.
6. Publish transactionally by moving the live-version pointer and preserving the immutable snapshot.
7. Roll back only to a compatible, previously approved version without changing payments, responses, or history.
8. Suspend, resume, or expire invitation availability through audited state transitions and session-generation invalidation.

### Exit evidence

Live PostgreSQL integration tests prove customer ownership, review locking, stale and superseded decision rejection, payment blocking, exact publication, material correction publication, compatible rollback, and availability transitions. Database triggers preserve immutable versions, approval ownership, and same-invitation live pointers. Editing draft-dependent content increments the aggregate revision, so it cannot alter or silently replace the live snapshot.

## Phase 6: implementation record

Phase 6 completed the private household distribution and response path for live invitations.

### Delivered

1. Create households individually or import bounded CSV with named adults, children, and allocated additional guests.
2. Issue one 256-bit bearer credential per household, retain only its keyed digest for lookup, encrypt its reissue copy, and exchange it for an HttpOnly guest session.
3. Render live immutable snapshots through the shared invitation engine after verifying invitation availability, expiry, link generation, access epoch, and household state.
4. Enforce allocated seats, required unnamed-adult names, server-side RSVP deadlines, response revisions, idempotency keys, and per-credential rate limits.
5. Support response amendments, admin corrections with reasons, host link rotation and revocation, and immediate invalidation of prior sessions.
6. Derive response totals and export formula-safe CSV without exposing raw database rows.
7. Add admin job-order intake, in-place customer account creation, a default sellable package snapshot, and workspace sign-out.
8. Add database guards for one active household link, positive credential generations, and same-household RSVP attendee seats.

### Exit evidence

Live PostgreSQL tests prove forwarded-link behavior, private session exchange, allocated seats, idempotent writes, stale-write rejection, cross-household database enforcement, safe export, correction, rotation, and revocation. Purpose-specific APIs use private no-store responses, HttpOnly cookies, bounded request schemas, origin checks, and server-only secrets. Physical iPhone, Android, Messenger, and WhatsApp checks remain part of the Phase 1 release gate.

## Phase 7: implementation record

Phase 7 completed the application layer for operating, monitoring, backing up, expiring, and recovering the service.

### Delivered

1. Record append-only manual receipts and one exact reversal with admin authorization, idempotency, currency checks, derived balances, and audit history.
2. Show actionable production, overdue-order, failed-task, backup, and notification queues to admins, with an audited retry action for failed durable tasks.
3. Queue fixed customer review and publication emails, deliver them with provider idempotency, and keep private content out of templates and logs.
4. Copy ready customer media to independent S3-compatible storage, verify bytes and checksums, and block publication until referenced media backups are verified.
5. Revoke guest access on expiry or removal, export durable deletion tombstones, purge personal event and guest content, remove primary and backup media, and preserve financial records separately.
6. Run bounded media, backup, email, retention, and cleanup work through one authenticated Vercel cron while retaining PostgreSQL leases and retries.
7. Emit structured run telemetry and privacy-reduced Sentry events, and provide a guarded isolated restore drill that replays external deletion tombstones.
8. Hide staff-only workspace navigation from customers after role resolution.

### Exit evidence and remaining infrastructure gate

Earlier domain and PostgreSQL tests covered the legacy payment, authorization, publication, media, and RSVP foundation. Commerce migrations 0020 through 0024 have been applied and schema-verified on the development database, but not on staging. Production credentials are intentionally absent from the repository, so the actual off-provider copy and isolated PITR restore still require infrastructure configuration and a recorded drill. The commercial release must remain closed until those gates, device checks, and sales blockers are resolved.

## Pilot and launch gates

Do not accept real payments until live merchant activation, account email delivery, published prices and capacity, cancellation and tax/invoice terms, licensed music provenance or removal, separate customer-media backups, an isolated restore, and physical-device behavior are verified. Staging must exercise every design through purchase, production, approval, publication, and private RSVP. Keep test and production credentials separate.

Pilots should measure designer hours, revision counts, delivery time, refunds, customer support, guest completion, and margin per tier before expanding into more event categories.

## Operating rules

- The primary queue must show what needs action, who owns it, and when it is due.
- Limit each designer to three simultaneously active design jobs until measured data supports a change.
- Track staff touch time during pilots. Open-order count alone is not capacity.
- Treat artwork preparation, revision handling, and final QA as likely bottlenecks.
- Do not promise unlimited customization, DRM, music rights, exact visitor counts, or delivery/read receipts.
- Do not accept paid work until the blocking business decisions are documented.

## Documentation maintenance

When a product priority, showcase milestone, architecture decision, release gate, or operational procedure changes, update the affected documentation in the same change. At each phase boundary:

1. Update the status table and next-phase section in this document.
2. Add or update a phase acceptance record with verified evidence and explicit remaining gates.
3. Update `.env.example` when configuration changes, without committing real secrets.
4. Add or revise an ADR when an architectural decision changes.
5. Update the production runbook for new operational dependencies.
6. Commit the documentation with the implementation it describes.

Keep `AGENTS.md` as a short current orientation, this plan as the canonical product and status record, and acceptance records as evidence of completed gates. Do not mark a sample product, backend integration, pilot, or launch complete based on intent alone.
