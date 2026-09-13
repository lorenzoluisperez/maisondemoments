# Architecture decision records

Status: accepted for the MVP foundation. Revisit a decision only when the stated evidence is available.

| Decision | Choice | Rejected alternatives | Consequences and revisit evidence |
|---|---|---|---|
| 001 Service model | Designer-operated, one semi-custom package | Customer page builder, bespoke-only service | Keeps quality and scope controlled. Revisit after pilot margin and support data. |
| 002 Deployment shape | One TypeScript and Next.js application with domain modules | Early microservices or multi-app monorepo | Reduces operational overhead. Split only for measured isolation or bundle constraints. |
| 003 Content model | Event facts are separate from presentation configuration | Decorative text copies of facts | Prevents date and venue drift. Revisit only if a validated new content source cannot map cleanly. |
| 004 Event schemas | Four discriminated schemas over a shared base | One loose event JSON document | Makes required fields explicit. Add types through versioned migrations. |
| 005 Studio | Bounded composition controls | General page and animation editor | Preserves renderer safety. Expand only when repeated paid work needs a specific control. |
| 006 Publication | Immutable snapshots with pinned theme and renderer versions | Rendering mutable rows, per-event deploys | Review approval remains exact and rollback is safe. Migrate deliberately when compatibility code becomes costly. |
| 007 Guest access | Household bearer token exchanged for a server session | Guest accounts, public event passwords | Low guest friction with known forwarding risk. Add verified identity only if demand justifies it. |
| 008 Media | Private originals, quarantine, immutable derivatives | Public customer assets, app-server uploads | Improves privacy and processing control at the cost of signed delivery and backups. |
| 009 RSVP | Allocated slots are authoritative | Free-form guest counts | Prevents overbooking and models adults, children, and plus-ones consistently. |
| 010 State | Separate production, review, availability, and payment state | One overloaded order status | Avoids invalid combinations and preserves operational visibility. |
| 011 Background work | PostgreSQL tasks with leases and idempotency | In-memory jobs, immediate queue vendor | Provides durable work at current scale. Adopt a queue after measured contention. |
| 012 Retention and recovery | PITR plus separate media backups and deletion replay | Database-only backups, indefinite retention | Recovery covers files and removed records stay removed. Revisit after restore drills. |
| 013 Experience budgets | Semantic fallback, reduced motion, 600 KiB critical transfer, real-device gate | Animation-gated content, desktop-only QA | Makes practical information dependable. Adjust from field p75 data. |
