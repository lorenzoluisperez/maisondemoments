# Maison de Moments product and technical plan

Status: active source of truth

Last updated: 2026-09-14

This document records the agreed product direction, architecture, release boundaries, implementation phases, and current status. Update it whenever scope, architecture, or phase status changes.

## Current position

**The technical roadmap is entering Phase 5.** Phase 1 implementation and Phases 2 through 4 are complete. Phase 1 still requires its physical-device release gate. Some Phase 0 commercial and rights decisions remain open and must be resolved before accepting paid orders.

| Phase | Status | Evidence or remaining work |
|---|---|---|
| 0. Product and art contract | Partially complete | Product boundaries and architecture are documented. Pricing terms, artwork rights, privacy terms, and production capacity still need written decisions. |
| 1. Guest experience proof | Implementation complete, release gate pending | The shared scrollable renderer, eight presets, shortcuts, long-content behavior, and reduced motion are implemented. Physical iPhone, Android, and in-app-browser testing remains. |
| 2. Domain foundation | Complete | Four event schemas, live database model, ownership checks, JO generation, least-privilege runtime access, RLS, API boundaries, integration tests, and production build pass. |
| 3. Media and renderer | Complete | Private signed uploads, durable Sharp processing, immutable variants, signed delivery, cleanup, persistent artwork metadata, renderer asset bindings, live integration tests, and budgets pass. |
| 4. Production slice | Complete | Persistent event briefs, incremental customer autosave, completeness checks, media attachment, automatic drafts, and the conflict-safe constrained studio pass live integration tests. |
| 5. Review and publishing | **Next** | Implement frozen review versions, exact-version approval, publication, and rollback in the application. Database foundations already exist. |
| 6. Guests and RSVP | Not started | Implement household import, seat allocation, private link exchange, RSVP amendments, deadlines, and exports. Domain and credential primitives already exist. |
| 7. Operational hardening | Not started | Add payments ledger workflows, queues, monitoring, backups, deletion, retention, and restore drills. |
| 8. Private pilot | Not started | Complete at least two real pilot orders for each event type and measure time, usability, and margins. |
| 9. Public launch | Not started | Publish the marketing catalog and open controlled intake after all launch gates pass. |

Detailed completion evidence lives in the [Phase 1 acceptance record](phase-1-acceptance.md), [Phase 2 acceptance record](phase-2-acceptance.md), [Phase 3 acceptance record](phase-3-acceptance.md), and [Phase 4 acceptance record](phase-4-acceptance.md).

## Product definition

Maison de Moments is a designer-operated service for producing premium interactive invitations from structured customer information and reusable original artwork.

The product serves three audiences:

- Customers receive a distinctive invitation, a clear content and review process, and guest-response management.
- Guests receive an emotional introduction followed by dependable access to event details and RSVP.
- Staff receive a production system that prevents retyping customer facts, controls publication, and makes workload visible.

The initial business is a productized creative service. Customers buy a finished invitation and a defined hosting period. A future self-service product may reuse the platform, but self-service must not shape the first release.

## Fixed product decisions

- Support weddings, birthdays, debuts, and christenings.
- Launch with one semi-custom package and two coordinated artwork collections.
- Provide eight tested event and collection presets.
- Use one coherent, naturally scrollable theatrical journey.
- Keep Details and RSVP available throughout the invitation.
- Use private household links with allocated guest slots and no guest accounts.
- Give every household access to the same event activities.
- Let only admins publish during the MVP.
- Give each order one customer owner and final approver.
- Include two consolidated design revision rounds by default.
- Confirm quotes, deposits, and balances manually during the MVP.
- Host invitations through 90 days after the event by default.
- Limit the first package to 12 gallery photos and 500 households.
- Use English application interfaces while accepting Unicode customer content.
- Exclude uploaded video, arbitrary music, unlimited customization, and customer design editing from the MVP.

The service must describe reusable collections as semi-custom. Exclusive artwork and commissions require separate terms.

## MVP release boundary

The first sellable release includes:

- All four event types and eight event and collection presets.
- One shared scrollable theatrical guest journey.
- Customer portal and event-specific content collection.
- Constrained internal studio and reusable compositions.
- Immutable review versions and version-specific approval.
- Admin publication, rollback, suspension, expiry, and removal.
- Household links, allocated slots, RSVP amendments, and exports.
- Manual payment confirmation.
- Monitoring, durable background work, backups, retention, and recovery procedures.

Optional content modules are story, gallery, schedule, participant groups, dress code, gift information, and reminders. Scenes may contain several modules. Long information views grow or scroll naturally and must never be squeezed into a fixed-height theatrical frame.

## Roles and permissions

| Role | Allowed responsibilities |
|---|---|
| Customer | Manage owned orders, submit content and media, manage households, review versions, request revisions, approve, and view or export RSVPs. |
| Designer | Work only on assigned orders, inspect production content, configure supported layouts, prepare review versions, and complete internal QA. |
| Admin | Assign work, manage catalog and prices, confirm payments, publish, rollback, suspend, correct operational data, and manage access. |
| Guest | View one authorized household invitation and manage that household's response. |

Staff accounts require MFA. Designers do not need unrestricted payment details or guest-list exports. Customer approval applies to one immutable version.

## End-to-end workflow

1. The customer explores real demos and selects an event type, package, and collection.
2. An admin confirms the quote and creates the Job Order.
3. The customer completes event-specific sections and uploads media with incremental saving.
4. The server validates required content and media readiness.
5. Submitted content, confirmed deposit, collection, and delivery date make the order ready for production.
6. The system generates a draft from structured facts and a preset without staff retyping names, dates, or venues.
7. A designer applies bounded composition, typography, section, and animation choices.
8. Internal QA checks facts, visual fit, responsive behavior, accessibility, and budgets.
9. The system freezes an immutable review version.
10. The customer approves that version or submits one consolidated revision request.
11. An admin publishes the approved version after the payment gate passes.
12. The customer distributes household links.
13. Households respond and may amend responses until the deadline.
14. Post-publication corrections create a new draft, review, approval, and publication cycle.
15. Access expires after the contracted hosting period and personal content enters the retention workflow.

Customer delays pause the production promise. Turnaround begins only when the required brief and deposit are complete.

## Architecture baseline

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

## Next phase and later phases

### Phase 5: next implementation scope

Implement immutable review creation, consolidated feedback, exact-version approval, material-change handling, admin publication, rollback, suspension, expiry, and audit history. Exit when draft changes cannot alter a live invitation.

### Phase 6: guests and RSVP

Implement household import and entry, allocated slots, token issuance and rotation, session exchange, response amendments, deadlines, concurrency protection, admin corrections, and safe CSV export. Exit when forwarding, revocation, stale writes, seat totals, and deadline behavior pass integration and browser tests.

### Phase 7: operational hardening

Complete manual payment recording and reversals, production queues, alerts, email, background-task operations, PITR, separate media backups, deletion, retention, restoration, and removal replay. Exit after a successful isolated restore drill and end-to-end release check.

### Phase 8: private pilot

Complete at least two real orders for each event type. Measure staff touch time, revision count, device behavior, guest completion, support load, and contribution margin. Adjust package boundaries and pricing from evidence.

### Phase 9: public launch

Publish the marketing catalog and open controlled intake only when all eight presets, business terms, device gates, operational procedures, and capacity limits are ready.

## Business decisions required before paid sales

1. Package price, deposit, cancellation terms, included revisions, and correction versus redesign rules.
2. Written artwork ownership, reuse, exclusivity, attribution, and source-file custody terms.
3. Customer privacy notice, hosting period, removal process, processor agreements, and retention terms.
4. Financial-record retention reviewed with an accountant.
5. Measured weekly production capacity and an intake limit.
6. The two launch collections and their event-specific motifs.
7. A licensed music catalog, or an explicit launch without music.

Working defaults remain a manual quote, 50 percent deposit, balance before first publication, two consolidated revisions, three active design jobs per designer, and hosting through 90 days after the event.

## Operating rules

- The primary queue must show what needs action, who owns it, and when it is due.
- Limit each designer to three simultaneously active design jobs until measured data supports a change.
- Track staff touch time during pilots. Open-order count alone is not capacity.
- Treat artwork preparation, revision handling, and final QA as likely bottlenecks.
- Do not promise unlimited customization, DRM, music rights, exact visitor counts, or delivery/read receipts.
- Do not accept paid work until the blocking business decisions are documented.

## Documentation maintenance

At each phase boundary:

1. Update the status table and next-phase section in this document.
2. Add or update a phase acceptance record with verified evidence and explicit remaining gates.
3. Update `.env.example` when configuration changes, without committing real secrets.
4. Add or revise an ADR when an architectural decision changes.
5. Update the production runbook for new operational dependencies.
6. Commit the documentation with the implementation it describes.
