# Filipino heritage wedding showcase artwork

`/demo/wedding-bridgerton` is a separate fixture-driven invitation study. It uses the synthetic Lorenzo and Cham event facts from `/demo/wedding`, moving the ceremony to fictional Amihan Courtyard and the reception to fictional Hiraya Heritage Hall in Intramuros, Manila. Neither venue name is a claim about a real business.

The eleven original raster assets under `public/bridgerton-wedding/` were generated on 2026-09-27 with the built-in image tool and optimized as WebP with Sharp. The screenshots supplied for the brief informed the palette, stationery, and romantic tone. Their watermarks, phone frames, names, dates, and French venue imagery were not reused. Names, dates, itinerary, countdown numbers, and guest controls remain live HTML.

| Asset | Use and generation brief |
| --- | --- |
| `courtyard-desktop.webp` | Wide watercolor and fine gouache Intramuros courtyard at late afternoon, with capiz windows, carved wood, stone arches, sampaguita, pale roses, blue edge drapery, and clear central space for live text. No people or typography. |
| `courtyard-mobile.webp` | Independently composed tall version of the heritage courtyard, with architecture and garden path in the lower half and clear upper space for names and date. |
| `envelope-mobile.webp` | Full-frame closed powder-blue embossed sampaguita envelope, straight-on portrait view, symmetrical upper flap and lace-trimmed lower fold. No seal or typography. |
| `envelope-desktop.webp` | Separately composed landscape counterpart with the same stationery treatment and a wide symmetrical flap. |
| `filipino-formal.webp` | Editorial watercolor fashion plate of an embroidered ivory barong Tagalog and a floor-length blush Filipiniana with butterfly sleeves, framed by sampaguita and gold ornament. |
| `courtyard-evening.webp` | Wide Intramuros courtyard at dusk with capiz windows, lanterns, flowers, old stone, and clear space for the separately rendered RSVP correspondence card. |
| `blue-drapery.webp` | Transparent watercolor panel of gathered powder-blue silk, sampaguita, blush roses, gold cord, and tassel; mirrored at the countdown edges. |
| `floral-swag.webp` | Transparent watercolor sampaguita, ivory and dusty-rose flowers, tiny blue hydrangeas, sage leaves, and antique-gold filigree. Frames section headings, the register, and the RSVP card. |
| `pearl-seal.webp` | Pearlescent ivory wax seal with embossed sampaguita and a blank center. The L & C monogram remains live text. |
| `abaniko-fan.webp` | Ivory embroidered piña fan with mother-of-pearl ribs, gold trim, and a blue tassel, used above the attire copy. |
| `story-keepsakes.webp` | Watercolor book, letter, ring box, embroidered cloth, flowers, and candle beside capiz windows, used in the story spread. |

## Final generation prompt set

The image tool received one prompt per asset. The production instructions were:

- **Desktop courtyard:** Wide 16:9 original watercolor and fine gouache illustration of a fictional Intramuros Manila heritage courtyard with cream plaster, old stone, capiz windows, carved wooden doors, arched colonnade, sampaguita, pale blush roses, powder-blue silk drapery and gold lanterns. Soft late-afternoon light, a clear upper center for live names and date, and a garden leading inward below. Filipino heritage rather than a European château. No people, vehicles, text, logos, watermarks, or phone frame.
- **Mobile courtyard:** An independently composed tall 9:16 portrait illustration of the same Filipino heritage setting. Keep the upper center calm and bright for live text, with architecture and the garden path in the lower half. Narrow blue drapery and flowers at the edges. No people, vehicles, text, logos, watermarks, or phone frame.
- **Mobile envelope:** Straight-on 9:16 full-frame closed powder-blue handmade-paper envelope, extending beyond every edge. Symmetric upper flap with sides to about 35% of height and a rounded center tip requested at 61%; sampaguita embossing, pale-blue lace near the fold, and realistic paper shadows. No seal, monogram, text, watermark, or external scene.
- **Desktop envelope:** Separate straight-on 16:9 full-frame counterpart with symmetric upper flap, sides to about 20% of height and a center tip requested at 62%, using the same embossing, lace, and paper treatment. No seal, monogram, text, watermark, or external scene.
- **Formal attire:** Portrait editorial watercolor fashion plate on ivory: an embroidered ivory piña barong Tagalog over dark formal trousers beside a floor-length blush and champagne Filipiniana gown with butterfly sleeves. Anonymous figures, sampaguita border, antique-gold flourishes and pale-blue accents. No labels, text, watermark, or phone frame.
- **Evening courtyard:** Wide 16:9 original watercolor Intramuros courtyard at dusk, with stone arches, carved wood, capiz windows, lanterns, sampaguita, roses, and restrained blue edge drapery. Blue evening sky and warm candlelight, leaving central space for a live ivory RSVP card. No people, signs, text, logos, watermarks, or phone frame.
- **Blue drapery:** Narrow transparent watercolor cutout of one gathered powder-blue silk panel with sampaguita, blush roses, gold cord, and tassel, for mirroring at the countdown edges. No surrounding scene, wall, text, logo, watermark, or phone frame.

The design enhancement added four further original prompts:

- **Floral swag:** Transparent horizontal floral arc, ivory sampaguita and garden roses, dusty blush roses, tiny powder-blue hydrangeas, sage leaves, and fine antique-gold filigree. Hand-painted watercolor and gouache with clusters at both ends and a thin connecting center. No text, vase, frame, logo, or watermark.
- **Pearl seal:** Straight-on macro pearly ivory hand-poured wax seal, raised sampaguita vines and a pearl-bead rim, champagne highlights, blank smooth center for live typography. Transparent exterior, no outside cast shadow, lettering, props, or background scene.
- **Abaniko fan:** Open Filipino ivory embroidered piña-fabric fan with mother-of-pearl ribs, sampaguita embroidery, delicate antique-gold trim, powder-blue silk bow and tassel. Watercolor cutout on transparency, no people, lettering, or watermark.
- **Story keepsakes:** Wide watercolor tableau of an open blank book, pearl ring box with ring, blank letter tied with blue ribbon, embroidered piña cloth, sampaguita, pale roses, and a candlestick beside a soft capiz window. Feathered ivory edges, no people or readable text.

The generated envelope folds did not land at the percentages requested in the prompts. The implementation follows their measured final image geometry as noted below.

The generated envelope artwork is used as a traced, separately moving flap and pocket. The fold in the mobile source reaches the center at about 54.5% of the frame height; the desktop fold reaches about 76%. The seal combines original pearl artwork with live monogram text and remains attached to the flap layer. The corrected positive X rotation lifts the tip toward the viewer, then upward over the top hinge; front and reverse surfaces are separate, and the front hides naturally after crossing 90 degrees. The CSS perspective origin is at the top hinge. The automated opening test checks the outward rotation direction to prevent recurrence of the earlier inverted movement. The inner paper uses the existing `public/wedding-showcase/cotton-card-v4.webp` texture. The hero scenery stays mounted behind the opening, and its gentle zoom does not reset at the scene handoff. If envelope art fails to load, the guest can still reveal the invitation.

The soundtrack reuses `public/wedding-showcase/there-is-romance.mp3`. The composer’s [track listing](https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1100044) identifies “There is Romance,” ISRC USUAN1100044, by Kevin MacLeod under CC BY 4.0. The footer credits the track and links its license. The repository does not establish this MP3 file’s download source or modification history; verify those before a public release.

On 2026-09-27, `npm run check` passed lint, type checking, and 40 unit tests. `npm run build` produced the new static route. Six targeted Playwright checks passed against the production build at desktop and mobile viewports: sealed-state privacy, normal and reduced-motion opening, introduction timing, skip and replay, missing envelope art, Details and RSVP navigation, and keyboard dialog dismissal. Four smoke checks for the existing two wedding showcases passed in a development-server run. Visual screenshots were reviewed for sealed and intermediate opening frames, hero, countdown, attire, entourage, program, and RSVP; no horizontal overflow was observed at 390px or 1440px. One desktop opening check reset to the sealed state during a concurrent development-server run, then passed when rerun alone and in the production build. The cause of that isolated reset was not established.

These are browser viewport checks, not physical iPhone, Android, or in-app-browser verification. The original MP3 file provenance and physical-device review remain open before public release.

The subsequent design refinement adds floral section ornaments, a keepsake story spread, arched day/evening venue cards, a piña fan beside the attire, a framed parents panel, illustrated program cards, and a floral correspondence card. Mobile and desktop intermediate frames were inspected at 1.5, 2.1, 2.8, 4.4, 6.3, and 9 seconds, with a further settled-hero review. The hero wash was strengthened so dates and invitation copy remain readable over courtyard scenery. No horizontal overflow was observed at either 390px or 1440px.

After this refinement, `npm run check` again passed lint, TypeScript, and all 40 unit tests; `npm run build` passed; all six targeted desktop/mobile Playwright tests passed against the production build, including the new outward-rotation assertion. `git diff --check` passed. These results remain local browser evidence; deployment and physical devices were not checked.
