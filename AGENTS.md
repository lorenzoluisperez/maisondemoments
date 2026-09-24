# Maison de Moments project guidance

This repository is a designer-operated platform for premium, semi-custom interactive invitations. The first release covers weddings, birthdays, debuts, and christenings. Customers provide structured event facts, designers compose within bounded controls, customers approve an immutable version, and admins publish it. Guests use private household links and allocated RSVP seats. The product is a creative service, not a self-service page builder.

## Current product priority

- Build a collection of polished, distinct sample invitation products first. The fixture-driven wedding showcase at `/demo/wedding` is the initial AI-assisted proof of concept, not a backend-editable product or evidence that the portfolio is complete.
- Once enough finished examples exist, decide which facts and presentation choices recur, then make those products editable through the existing backend and bounded studio. The user has not set a sample count or approved an editor schema. Do not let anticipated backend controls dictate the creative design of new showcases.
- The existing portal, studio, and production infrastructure remain implemented. Maintain them when needed, but do not treat their existence as a reason to prioritize more editor features ahead of sample products.

## Start with the task

- Use this file as orientation. Inspect only the files and docs relevant to the request; do not scan the whole repository or run every check at the start of a new task.
- Treat [docs/product-and-technical-plan.md](docs/product-and-technical-plan.md) as the source of truth for product scope, architecture, phase status, and open launch gates. Check its current text before relying on a status claim.
- Use [docs/adr/README.md](docs/adr/README.md) for architectural changes, [docs/operations.md](docs/operations.md) for production and release work, and the relevant `docs/phase-*-acceptance.md` for phase evidence. Update those documents when the corresponding decision, gate, or operational procedure changes.
- Keep this file and the product plan current when product priorities or sequencing change. Record verified showcase progress in the docs when work lands; remove stale status claims rather than accumulating historical instructions here.
- `README.md` is the quick entry point for setup, routes, and commands. `package.json` defines the available checks.

## Product and implementation invariants

- Preserve the four event types, one semi-custom package, two artwork collections, and eight event and collection presets unless the user explicitly changes scope.
- Preserve a semantic, naturally scrollable guest journey with reliable access to Details and RSVP. Motion and media must not block practical information; reduced motion and long content must work. The synthetic wedding showcase reveals these controls after its opening.
- Keep event facts separate from presentation. Use the shared renderer for studio preview, customer review, and guest delivery. Do not give customers arbitrary HTML, CSS, scripts, or an unrestricted editor.
- Customer approval belongs to one immutable review version. Publication is admin-controlled and gated by the current approved version, payment balance, and verified backups of referenced customer media. Keep financial, RSVP, and audit history intact during rollback or corrections.
- Household links are bearer credentials. Protect tokens, sessions, guest data, and private media; honor revocation, allocated seats, deadlines, and access checks. Never expose secrets or private event facts through public demos or pre-authentication metadata.
- The synthetic wedding showcase at `app/demo/wedding` is separate from real household invitations. Before its opening completes, withhold post-reveal names, details, and RSVP from rendering and accessibility, rather than merely hiding them with CSS.

## Verification boundaries

- Choose checks for the touched area. `npm run check` covers lint, types, and unit tests; `npm run build` checks the production build; `npm run test:e2e` covers browser behavior. Consult `README.md` for additional gates.
- `npm run test:db` creates fixtures and is only for development or staging databases. Follow `docs/operations.md` before database migrations, restore drills, or production operations.
- Browser checks do not establish physical iPhone, Android, or in-app-browser behavior. Local tests do not establish that off-provider backup, PITR, or an isolated restore drill has passed. Report those gates separately when discussing pilot or launch readiness.
