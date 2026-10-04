# Eighteen in Wonderland showcase

The fictional eighteenth-birthday sample lives at `/demo/debut-wonderland`, with public discovery at `/designs/eighteen-in-wonderland`. It is the fifth viewing-only design, the second debut. Inquiries remain message-based. Sample replies change local component state only; no guest data is submitted or persisted.

## Art direction and content

The approved direction is a golden keyhole into a dreamy watercolor tea garden. The opening cover uses photographic powder-blue linen bookcloth over board. Painted scenery uses the appearance of fine-grain, warm ivory, cold-pressed cotton watercolor paper. Text pages reuse the project's smoother photographic cotton-card material with a restrained warm wash, soft edge shadows, a center fold on desktop spreads, and readable dark blue ink. The palette includes dusty rose, sage, powder blue, and antique gold. Characters and vignettes are original AI-generated watercolor-style interpretations, not claims of physical human-painted originals.

The fictional celebrant is Celeste Reyes, with an imagined event on 15 August 2027 at 6 PM Asia/Manila in The Looking-Glass Conservatory, Tagaytay. Venue and participants are labeled fictional, and no directions to a real venue are offered. The existing `DebutFixture` contract is reused, with new wording and program. The four groups reuse the 72 fictional names from the Pearl sample with design-specific identifiers and introductions. They are not guest accounts, RSVP seats, or authenticated recipients. Blue Bills contains no amounts or payment instructions. Empty groups are omitted.

The full guest journey includes a formal card, personal letter and Cheshire Cat delight, pocket-watch Details, attire and countdown, tea-party program, four distinct tradition spreads, a sample response card, and credits. Desktop spreads use paired pages; mobile uses a natural vertical sequence with all names readable. Existing system serif/sans stacks are reused, with no additional font license.

Research references informed the materials and physical behavior, rather than supplying copied art:

- [ARCHES cotton watercolor paper](https://arches-papers.com/arches-range-of-papers/watercolor-and-wet-techniques/arches-aquarelle/): natural grain, cotton fibres, and paper edges.
- [V&A paper peepshow](https://www.vam.ac.uk/articles/make-your-own-paper-peepshow): layered paper depth.
- [Robert Sabuda's Alice book, official publisher](https://www.simonandschuster.com/books/Alices-Adventures-in-Wonderland/Lewis-Carroll/9780689847431): tactile pop-up constructions and unfolding scenes.
- [V&A Alice exhibition](https://www.vam.ac.uk/exhibitions/alice-curiouser-and-curiouser): Wonderland as a complete theatrical guest journey.

## Asset provenance

All new bitmap art was generated with the built-in image-generation tool on 4 October 2026, then optimized to WebP with Sharp. Portrait garden and paper-arch compositions use their landscape masters as style references, preserving lighting, watercolor technique, and palette while recomposing for phones. Resizing is proportional and preserves generated alpha. Full prompts are in [debut-wonderland-art-prompts.md](debut-wonderland-art-prompts.md).

| Serving asset under `public/debut-wonderland/` | Source PNG ID | Purpose |
|---|---|---|
| `garden-desktop-v1.webp` | `048903ca-687e-4809-8431-7837e0f4b9af` | Landscape master tea garden |
| `garden-mobile-v1.webp` | `5872cfdf-52b9-4ed2-b5b8-03dfd68c92b5` | Portrait master tea garden |
| `bookcloth-v1.webp` | `079ac242-65f5-4d1c-9c36-444d899aa922` | Photographic linen cover material |
| `paper-arch-desktop-v1.webp` | `f4b097b3-52bc-4a1c-8748-446c7c2d2643` | Transparent landscape paper theatre layer |
| `paper-arch-mobile-v1.webp` | `2f09979a-300b-45d3-88f0-096f60d9d7ee` | Transparent portrait paper theatre layer |
| `watercolor-roses-v1.webp` | `f01fcde0-b1e0-4815-b185-77d6fb0f3930` | Rose pitcher and heart cards |
| `watercolor-candles-v1.webp` | `9474a754-6727-4427-bc7d-f0b1af1cf048` | Candles, teacup, and butterfly |
| `watercolor-treasures-v1.webp` | `b0102e3f-013f-4a3e-af27-36527413bb3d` | Storybooks and keepsake key |
| `watercolor-blue-bills-v1.webp` | `3c87dcdd-5ae1-4166-81aa-ed3208e10eec` | Tea setting and gift envelopes |
| `cheshire-cat-v1.webp` | `d8b8b0b3-18b0-4d3d-b646-55937f84a8be` | Optional painted cat interaction |
| `golden-key-v1.webp` | `bd808f7c-784c-475c-b479-ba70d6f19f4d` | Animated opening key |
| `brass-keyhole-v2.webp` | `db691e1b-c36b-4691-b0df-c94a7e2aae74` | Realistic engraved brass fitting with transparent aperture |
| `pocket-watch-v1.webp` | `43b7307f-7b66-48a6-b796-11e71bfe7141` | Illustrated Details trigger |
| `invitation-preview-v2.webp` | Browser capture of the implemented hero | Complete current stationery card with persistent flowers and tea pieces |

Source PNGs are cached at `/Users/lorenzoperez/.codex/generated_images/01a1035d-af71-7ac0-a338-68eb6633dd1d/exec-<source ID>.png`. Runtime references use only repository files. The brass fitting is raster art, proportionally resized to 650 × 1138. `keyhole-v2.svg` traces the enclosed transparent aperture measured from that source's alpha channel, so the expanding cover mask and painted peek agree with the metal opening. Rules and the transient cat-smile overlay are code-native SVG/CSS decoration. All lettering and event facts are live HTML. The card preview is statically imported so its served URL changes with its contents and remains uncropped on all discovery surfaces.

The existing `public/wedding-showcase/cotton-card-v4.webp` supplies paper material; its provenance remains in `docs/wedding-showcase-assets.md`. Piano reuses “There is Romance” by Kevin MacLeod under CC BY 4.0, with visible source/license attribution. See `public/wedding-showcase/MUSIC-LICENSE.txt`.

## Opening, accessibility, and resilience

One GSAP timeline controls the approximately 10.8-second sequence after critical artwork is decoded:

- 0–1.95 s: the key moves from its resting position into the lock (0.65 s), turns around its shaft (0.8 s), then withdraws (0.5 s). A nested transform separates insertion perspective from the turn; the contact shadow tightens as it seats.
- 1.85–4.8 s: the keyhole expands around the same anchor; two paper arches move past the guest at different depths. A painted glimpse inside the closed hole fades into the underlying scene. The metal fitting fades as the camera passes it, avoiding a magnified blurry metal wall.
- 4.8–6.4 s: foreground watercolor pieces lift from their bottom fold and settle at the lower edges. They remain in the same mounted theatre plane through introduction and invitation, then scroll away naturally with the hero. Skip and reduced motion also retain them; replay resets them.
- 6.4–10.8 s: introduction fades in for 0.6 s, holds fully readable for 3.2 s, then fades out for 0.6 s. The formal card fades in after reveal.

The garden image stays mounted at the same viewport-sized crop through all stages. Its one gentle camera movement ends at scale 1.025 and remains there through introduction and hero. Portrait and landscape art use uniform `object-fit: cover` scaling with intentional edge cropping. The CSS mask and brass rim share their width, scale, and center, including orientation changes.

Event names, details, participant lists, and RSVP are absent from rendered content and accessibility until reveal. This synthetic fixture is not a private-data security boundary. The opening button is disabled until its client interaction handler is hydrated, preventing lost early gestures. Repeated opening gestures cannot start duplicate runs. Skip, replay, reduced-motion changes, critical asset failure, and unmount kill the timeline and invalidate delayed preparation. Reduced motion reveals after a guest gesture; failed art still leaves a static card and actionable Details/RSVP. Music starts synchronously from the opening gesture at 28% media volume, uses `preload="none"`, respects mute preference on replay, resets its track on replay, and pauses on unmount. Unavailable or blocked music does not gate content.

Keyboard opening moves focus to the invitation heading; replay restores the opening button. Group navigation focuses the chosen section. Details closes back to its activating navigation/watch button, or moves focus to RSVP when requested. The Details card declares its own material and ink variables because the Radix portal sits outside the showcase's CSS scope. An opaque paper fallback keeps the card readable even if the paper texture fails. Opening Details cancels an unfinished smooth page scroll before the modal takes focus. The optional cat interaction resets after 2.8 seconds and cancels on unmount/replay.

## Local verification

Verified locally on 4 October 2026:

- `npm run check` passed lint, TypeScript, and all 50 unit tests.
- `npx playwright test tests/e2e/debut-wonderland.spec.ts tests/e2e/storefront.spec.ts tests/e2e/debut-pearl.spec.ts` passed all 38 desktop/mobile browser tests against the built production server. Coverage includes pre-reveal protection, keyboard focus, all 72 names, opaque Details paper/ink and viewport fit, sample replies without writes, key insertion/turn transforms, persistent foreground position through reveal, replay reset, reduced motion, delayed or missing artwork, unavailable audio, orientation changes, and complete catalog previews. Existing debut selectors now accept both Webpack and Turbopack CSS-module names; preview fingerprint checks accept production hash formats too.
- `npm run build` passed and generated the new demo route. The production bundle also completed its real opening, Details, and sample reply on desktop (1440 × 960) and mobile (390 × 844), with all four groups of 18 names, no page errors, no write requests, and no horizontal overflow.
- Existing Pearl & Poise playback was inspected before implementation. The revised Wonderland production playback was reviewed at intermediate frames on desktop and mobile, including insertion, shaft turn, withdrawal, keyhole expansion, paper folds, introduction, and hero handoff. The introduction holds at full readability for 3.2 seconds, and the same mounted garden and retained foreground preserve their framing through reveal.
- The complete storybook spreads, correspondence card, narrow layouts, artwork dimensions and transparency, and refreshed uncropped 1000 × 1611 catalog preview were visually reviewed. Revised screenshots, playback recordings, and production evidence are saved locally in the ignored `outputs/wonderland-review/revision/production/` directory.

These results establish local browser behavior and visual review. No deployment, production database operation, physical iPhone/Android, or social in-app-browser validation is included in this work.
