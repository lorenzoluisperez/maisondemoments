# Phase 5 review and publishing acceptance

## Immutable review path

- An assigned designer or admin can create a client review only from a complete, submitted brief and a current editable draft after completing the required content, responsive, accessibility, and media checks.
- Review creation runs under an order-scoped transaction lock, compiles the same structured invitation used by preview and guest rendering, validates the resolved snapshot, stores its deterministic SHA-256 content hash, and locks the draft in `IN_REVIEW`.
- Each version records its source draft revision, renderer compatibility version, material changes, creator, and retained media references.
- Frozen review routes render the stored snapshot. Later edits cannot change that version.

## Customer decisions

- Only the customer who owns the order may review and decide the version. Other customers receive no existence disclosure.
- One version accepts either one approval or one consolidated change request. The server rejects repeated, stale, and superseded decisions.
- Consolidated feedback contains a bounded summary and up to 30 section-specific items.
- Requested changes return the draft to `CHANGES_REQUESTED`. Designer updates then return it to `EDITING` and increment its revision.
- Customer-content edits also increment the invitation draft revision, clear brief submission, and invalidate the prior review until the complete brief is resubmitted.

## Publication and availability

- Only an active admin may publish. The database transaction requires the exact current approved version, the order owner's approval, the same invitation, an active unexpired hosting period, and no outstanding balance.
- Publication updates only the live-version pointer, availability, first-publication timestamp, order delivery state, and audit history. It never renders from mutable event or draft tables.
- Rollback accepts only a previously approved version from the same invitation with the same renderer compatibility version. Guest responses, payments, and review history remain intact.
- Suspension and expiry increment the invitation access epoch. Resume requires an unexpired invitation with a live version. Every availability transition requires a reason and writes an audit event.

## Security and database controls

- Database triggers prevent approvals and change requests from claiming a different customer and prevent a live-version pointer from crossing invitation ownership.
- Approved and published version rows remain immutable. Purpose-specific API routes enforce authenticated roles, same-origin JSON mutations, bounded payloads, and private no-store responses.
- Browser database roles retain no access to application tables or privileged publication functions. The server-only application role has the minimum grants required by the existing architecture.

## Verified gates

- 35 domain tests pass, including strict review input and material-change classification.
- 19 live PostgreSQL and Storage integration tests pass. Five exercise the full Phase 5 flow: frozen review, consolidated feedback, exact customer approval, payment blocking, publication, post-publication correction, rollback, suspension, resumption, and expiry.
- Database verification reports 32 RLS-enabled application tables, 11 applied migrations, no browser-role table grants, no public function grants, and no missing foreign-key indexes.
- Supabase schema lint reports no errors. Supabase security and performance advisors report no issues.
- Drizzle reports no schema drift after generating the Phase 5 migration.
- Lint, TypeScript, media verification, the production Next.js build, and guest performance budgets pass through `npm run check:full`.
- A local browser smoke check confirms the private review route renders its sign-in boundary without a framework overlay, console error, or warning.

## Remaining release gate

Physical iPhone Safari, lower-powered Android Chrome, Messenger, and WhatsApp in-app browser checks remain part of the Phase 1 release gate. Phase 5 does not claim those device results.
