# Phase 4 production-slice acceptance

## Customer content path

- Every job order owns one revisioned event brief, seeded from its normalized event and capable of preserving incomplete customer work.
- The authenticated portal lists only authorized orders and edits event-specific identity, schedule, participants, wording, and photo references.
- Weddings, birthdays, debuts, and christenings retain separate validated identity fields. Christening parents or guardians are edited separately from godparents and other participants.
- Customer changes autosave after a short idle period. The server checks the last-read revision, rejects stale writes, and provides an explicit reload path.
- Completion issues identify the relevant section. Submission remains disabled until the current draft is saved and complete.
- Submission verifies each selected photo belongs to the order and is ready, then replaces normalized event facts and creates a collection-pinned invitation draft in one transaction.

## Production studio

- Staff receive a searchable order queue with readiness, active-design, waiting-brief, assignment, and due-date context.
- Assigned designers and admins open a live draft whose preview is rendered by the shared invitation engine.
- The constrained editor supports released typography presets, three motion levels, declared scene layouts, and bounded position, scale, rotation, layer, and visibility controls for existing decorative assets.
- The renderer applies placement through individual transform properties so scene animation cannot overwrite the designer's composition.
- Studio changes autosave with optimistic concurrency. Stale writes require a reload, review-locked drafts reject saves, and local undo/redo retains up to 50 editing steps.
- Customer facts remain separate from presentation overrides. Designers cannot type alternate dates or names, change theme versions, add arbitrary CSS or scripts, or attach cross-collection artwork.
- The Phase 4 studio boundary reserved review creation for the immutable version and exact-approval workflow now implemented in Phase 5.

## Security and database controls

- The `event_briefs` table uses row-level security and the same least-privilege application role as the other private tables.
- Browser roles retain no direct application-table access. Portal and studio responses use `Cache-Control: private, no-store`.
- Customer ownership and staff assignment are enforced server-side on reads, saves, uploads, and preview rendering.
- Draft and brief mutations write bounded audit metadata without copying personal content into the audit event.

## Verified gates

- 32 domain tests pass, including all four event-brief round trips, incomplete-content guidance, and rejection of unsupported studio fields.
- 14 live PostgreSQL and Storage integration tests pass, including revision conflicts, customer and designer isolation, normalized brief submission, generated drafts, bounded studio updates, media processing, and denial of raw browser-key table access.
- Database verification reports 31 RLS-enabled application tables, nine applied migrations, no browser-role table grants, no public function grants, and no missing foreign-key indexes.
- Supabase schema lint reports no errors.
- Lint, TypeScript, the production Next.js build, media verification, and guest performance budgets pass through `npm run check:full`.
- Browser smoke checks show meaningful login, portal, studio, and invitation content with no framework overlay, console error, or warning. The invitation exposes five natural-scroll scenes and persistent Details and RSVP controls.

## Remaining release gate

Physical iPhone Safari, lower-powered Android Chrome, Messenger, and WhatsApp in-app browser checks remain part of the Phase 1 release gate. Phase 4 does not claim those device results.
