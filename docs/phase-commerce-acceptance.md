# Commercial wedding release acceptance

Status: local implementation evidence only, 2026-09-29. Not accepted for live sales.

## Verified locally

- The storefront shows Garden Romance, Coastal Romance, and Heritage Romance. The two previous homepage collections are absent, and the three `/demo` routes remain fictional previews.
- `npm run check` passed with 50 unit tests. `npm run build` passed. `npm run test:e2e` passed all 20 desktop and mobile browser tests for the storefront and the three demo guest journeys.
- Desktop and mobile screenshots of `/` and `/designs/garden-romance` were inspected locally. The page compositions and package cards remained readable at 1440 px and 390 px. This is a limited visual check, not approval of all invitation states.
- Checkout is closed by default with `COMMERCE_CHECKOUT_ENABLED=false`, and seeded Essential and Signature offers are disabled. Product prices and terms cannot be inferred from sample fixtures.
- Code review and unit tests cover signed PayMongo payload validation, a single confirmed payment identity, product fixture personalization, selected-design rendering, bounded presentation options, conservative name/venue fit rules, exact provider refund matching, and production-cost input limits. A provider-confirmed full refund path, aggregate funnel counters, and recorded contribution reports are present, but have not been exercised against PayMongo or staging PostgreSQL.
- Commerce migrations 0020 through 0024 were applied to the development database. `npm run db:verify` passed with 25 migrations, 42 RLS-enabled application tables, no browser table grants, no public function grants, and no missing foreign-key indexes. The first full database suite exposed a stale fixed-year guest fixture; the repaired guest suite passed on its focused rerun. This is development evidence, not staging acceptance.

## Required before live sales

- Apply reviewed migrations 0020 through 0024 to an isolated staging database, then run `npm run db:verify` and `npm run test:db`. Do not point fixture-creating checks at production.
- Complete a PayMongo test-mode purchase-to-publication journey for each design, including duplicate and delayed webhook handling, retry, reconciliation, Couture quote acceptance, exact-version approval, guest access, RSVP limits, and a provider-confirmed refund.
- Configure and verify real prices, booking capacity, delivery promises, immutable service and cancellation terms, tax and invoice handling, PayMongo merchant activation, and email-code delivery.
- Validate real long-name, maximum-program, missing-media, failed-audio, reduced-motion, and overflow cases in studio preview, customer review, and live invitations on representative widths and physical devices.
- Verify music-file rights, independent media backups and isolated restore, operational recovery, funnel counts, and complete production cost recording. Partial refunds and automatic refund discovery remain unsupported in the application.

Only after these checks are evidenced should production checkout be enabled and individual offers opened.
