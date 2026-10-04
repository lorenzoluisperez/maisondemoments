# Pearl & Poise debut showcase

The fictional showcase lives at `/demo/debut-pearl`, with public discovery at `/designs/pearl-and-poise`. It introduces Debuts / 18th Birthdays alongside the three wedding designs. Public inquiries remain message-based; this does not enable commerce or private delivery for the new design.

## Art direction and content

Realistic blush handmade cotton paper, embossed floral folds, a dimensional pearl-ivory seal, champagne-gold fine borders, dark serif typography, and hand-painted watercolor-style illustrations. Paper is a photographic material; roses, candles, keepsakes, and gift envelopes are painted vignettes. The new envelope fills the viewport, with different portrait and landscape artwork composed for each breakpoint. The original flat CSS envelope and line-art tribute icons were replaced after visual feedback.

No portrait is needed. Guest-initiated piano music accompanies the invitation, with a persistent play/mute control. The fictional celebrant is Amara Santos, celebrating on 8 November 2027 at 5:30 PM Asia/Manila in the imagined Pearl Conservatory, Makati. The sample clearly identifies its fictional venue and participants and does not provide directions to a real venue.

The fixture separates event facts, program entries, and four ordered celebration groups: Roses, Candles, Treasures, and Blue Bills. Each group contains 18 named fictional participants. Empty groups are omitted. Blue Bills wording expresses gratitude without monetary amounts or payment instructions. Group members are never interpreted as authenticated guests or RSVP seats.

Tradition references used during planning:
- https://www.eventifai.com/planning-guides/debut-18-candles-18-roses-18-treasures
- https://folklore.usc.edu/debut-18th-birthday/
- https://theshannaiabee.wordpress.com/2018/06/16/planning-for-a-debut/

## Asset provenance

All new art was generated with the built-in image-generation tool on 30 September 2026, then optimized to WebP with Sharp. Watercolor refers to visual style, not a claim of physical human-painted originals. Transparent alpha is preserved for the seal and painted vignettes. No external stock imagery or photography was used.

| Workspace asset under `public/debut-pearl/` | Source PNG ID | Purpose |
|---|---|---|
| `envelope-desktop-v2.webp` | `8cd90093-03be-474f-8547-42e586f616bc` | 1536 × 1024 photographic envelope |
| `envelope-mobile-v2.webp` | `471f35be-743b-4d71-b9e3-50205078fdbc` | 1024 × 1536 portrait envelope |
| `pearl-seal-v2.webp` | `23350fe5-1761-4b9f-a14c-519a10e5b0ed` | 520 × 520 transparent wax medallion |
| `watercolor-florals-v2.webp` | `5164998f-7be4-4488-892b-504ab2b34e73` | 800 × 1200 transparent botanical corner |
| `watercolor-roses-v2.webp` | `c6ffe415-212e-45bd-acf1-1d928e7bee19` | Painted rose vignette |
| `watercolor-candles-v2.webp` | `84c1a947-0c0e-4553-bb91-8d8b9f6a47f5` | Painted candle vignette |
| `watercolor-treasures-v2.webp` | `8d998ce9-36bb-478e-9710-c363ac1d7abf` | Painted keepsake vignette |
| `watercolor-blue-bills-v2.webp` | `aeeca4e3-91c2-4139-b38d-a9ff8eee50cf` | Painted gift envelope vignette |
| `invitation-preview-v3.webp` | Fresh 3× portrait browser capture of this implementation | Complete current card for catalog discovery |

The source PNGs remain at `/Users/lorenzoperez/.codex/generated_images/01a0ee6e-46fd-7370-9618-1a5fa99f65d5/exec-<source ID>.png`. Serving files are all in the repository. The earlier v1 floral paper and preview were superseded and removed from serving assets.

Card stock reuses the project's photographic `public/wedding-showcase/cotton-card-v4.webp`, with restrained warm washes and a smaller grain scale for readability. Its original prompt and provenance remain in `docs/wedding-showcase-assets.md`. The pocket and flap sample the same envelope image, clipped to the observed edge. Portrait and landscape use separate art at its native 2:3 and 3:2 proportions. The shared artwork plane covers the entire dynamic viewport with a small bleed, cropping at the edges without stretching. Its seal anchor keeps the attached seal and live opening target aligned and visible after resizing or rotating. There are no surrounding margins. The invitation and keepsake monograms are circular. A shared palette coordinates warm ivory, muted blush, dark ink, and restrained champagne ornaments, including the details dialog. The reverse uses cotton-paper material. Typography uses the existing Georgia/Times New Roman and Arial system stacks. Fine rules and flourishes remain semantic/code-native stationery decoration. No new font license is introduced. Music reuses “There is Romance” by Kevin MacLeod under CC BY 4.0, with visible attribution and source/license links in the footer. See `public/wedding-showcase/MUSIC-LICENSE.txt` for the verified source and checksum.

The complete new generation prompts are in [debut-pearl-art-prompts.md](debut-pearl-art-prompts.md).

## Opening and accessibility

The underlying paper scene stays mounted with the same crop and geometry. The flap and attached seal lift outward around the top hinge over 6.8 seconds. The lower pocket begins clearing after 35 percent of that movement. At 6.3 seconds, the introduction starts while the last envelope edge clears: approximately 0.6 seconds fade-in, 3.2 seconds fully readable, and 0.6 seconds fade-out. At 10.7 seconds, the formal invitation fades in. Fixed post-reveal controls do not move the card.

Pre-reveal event details, names, participant lists, and RSVP are absent from the rendered page and accessibility tree. This is a synthetic public fixture, not a security boundary for private data. Skip, replay, changing reduced-motion preferences, and critical artwork failure cancel pending sequence timers. Reduced motion reveals the invitation after a guest gesture. Missing envelope or seal artwork falls back to cotton-paper styling with an accessible Open control. Music is neither fetched nor played before the opening gesture. The opening prompt discloses music, which starts at 28 percent media volume (device volume still applies). Skip and reduced motion keep music independent of the visual sequence. Replay pauses and resets the track while preserving the guest’s muted preference; unmount pauses playback. A missing or blocked soundtrack never prevents opening or access to details and RSVP. No response is persisted or submitted.

## Local verification, 30 September 2026

- `npm run check`: passed lint, TypeScript, and all 50 unit tests.
- Focused debut browser suite: 14 tests passed across desktop and mobile Chromium, including full content, all 72 names, keyboard/focus, outward flap rotation, at least 3 seconds of full introduction readability, stable paper geometry, skip/replay, reduced-motion changes, missing artwork, expired countdown, demonstration-only RSVP, and full-screen coverage with undistorted proportions and aligned seal targets across six portrait/landscape viewport sizes. Music checks verify no pre-gesture request or playback, actual playback progress, mute/play, skip, replay reset and preference, reduced motion, and a missing soundtrack.
- Follow-up navigation and preview checks: 8 focused desktop/mobile cases passed, including keyboard activation of all four celebration links, section focus, current fingerprinted preview loading across the homepage, catalog, and design details, complete-card sizing, existing wedding discovery, and no debut wedding metrics. Screenshots are in `outputs/pearl-affordance/`.
- Original storefront browser suite: all 8 desktop/mobile cases passed for four designs, category discovery, ordering instructions, paused-route redirects, and exclusion of debut views from wedding commerce metrics.
- Visual review inspected desktop and mobile opening frames at 1.2, 2.6, 4, 5.2, 6, 8.2, and 10.4 seconds; reviewed the card, program, tribute lists, and response card. A subsequent material pass softened paper contrast while preserving visible grain. Desktop 1440 × 960, mobile 390 × 844, and small-mobile 320 × 667 checks showed no horizontal overflow.
- Local screenshots and playback captures are in ignored `outputs/pearl-review-v2/`, with the final proportion and palette review in `outputs/pearl-proportions/`. The final pass includes 1470 × 746, 390 × 844, 768 × 1024, 2560 × 1080, 844 × 390, and 320 × 667 viewport checks, and desktop/mobile opening playback. The card preview was refreshed with the circular monogram and coordinated palette. The latest portrait preview is statically imported so its URL changes with its content, preventing reuse of an old optimized image. All three discovery surfaces contain the full card within a neutral surround instead of cropping it. Celebration jump links use bordered 48px targets, down arrows, hover/focus feedback, and a two-column mobile arrangement; keyboard navigation moves focus to the chosen group. They are review evidence, not source assets.
- Slower opening and soundtrack review: desktop/mobile frames checked at 1.6, 3.2, 4.8, 7.1, and 11.2 seconds; actual media time advanced with no audio errors. Captures are in `outputs/pearl-music/`. Browser playback does not establish physical-device audio behavior.
- `npm run build`: passed, including generation of the debut sample route. No deployment or physical iPhone, Android, or in-app-browser verification is claimed.
