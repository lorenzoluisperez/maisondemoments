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
