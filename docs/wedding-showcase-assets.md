# Wedding showcase asset provenance

Artwork under `public/wedding-showcase` was generated for this project. This page keeps both the current asset map and earlier prompt history. `components/demo/three-envelope.tsx`, `components/demo/wedding-showcase.tsx`, and `components/demo/wedding-showcase.module.css` determine which assets the showcase actually loads. Page headings and invitation text remain semantic HTML.

## Current showcase assets

- The opening loads `envelope-victorian-ivory-v1.webp` on mobile, `envelope-victorian-desktop-v1.webp` on desktop, `wax-lc-pearl-v1.webp` for the seal, and `cotton-card-v4.webp` for paper texture. The static opening uses the matching envelope and seal images.
- The reveal and later scenes use the Tagaytay invitation backgrounds and watercolor illustrations in `public/wedding-showcase`; the component and stylesheet select the exact files at each viewport.
- The soundtrack is `there-is-romance.mp3`. Its track and license information is in [MUSIC-LICENSE.txt](../public/wedding-showcase/MUSIC-LICENSE.txt), and the showcase footer credits it.
- The closed envelope exposes only the seal initials, opening prompt, and music choice. Names, event information, and Details/RSVP navigation render after opening. Post-reveal content is absent from keyboard and accessibility navigation until then.

The exact generation prompts for the newer Victorian envelope, pearl seal, Tagaytay backgrounds, and watercolor illustrations are not recorded in this file. Do not treat the older prompts below as provenance for those assets.

## Historical opening and reveal, revision 4

- `public/wedding-showcase/envelope-cotton-v3.webp`: full-bleed cotton-paper envelope, 329,426 bytes.
- `public/wedding-showcase/wax-lc-v3.webp`: transparent bronze seal with impressed initials, 136,332 bytes.
- `public/wedding-showcase/flowers-ribbon-v3.webp`: transparent foreground flowers and silk ribbon, 179,008 bytes.
- `public/wedding-showcase/cotton-card-v4.webp`: generated cotton-rag paper texture, 1,000 × 1,000 pixels, 241,154 bytes. Used for the inner lining, flap reverse, extracted card, and revealed stationery.

This revision used olive silk, layered stationery, and flowers/ribbon. The newer showcase uses different envelope and seal art. Keep these prompts for historical asset provenance.

These are original generated assets, not photographs of real stationery. The opening uses photographic textures on separately animated Three.js surfaces. Its lighting detail is partly baked into those textures; it is not a physically simulated paper/wax material. A matching HTML poster appears immediately during loading and is also the reduced-motion/WebGL fallback.

### Exact final prompt: envelope-cotton-v3.webp

Use case: product-mockup. Asset type: photographic texture for a full-screen interactive wedding envelope. Create a portrait 9:16 extreme macro photograph, straight on, perfectly flat frontal camera with no perspective angle, of a closed premium ivory handmade cotton-paper envelope. The envelope extends beyond ALL FOUR borders of the image, absolutely no tabletop or environment visible. The image IS the envelope. Rich fine visible paper fibers and subtle grain, deckled folded edges, believable gentle dark contact shadows under each folded edge, beautifully soft warm-neutral daylight from upper left. Exact construction: the large upper closing flap fills the entire top, its vertical sides continue down to about 36 percent of image height, then two straight diagonals slope inward to one softly rounded downward-pointing tip at horizontal center, 66 percent image height. The two bottom envelope folds meet beneath this point and run diagonally towards the bottom corners. Thick tactile stationery, restrained luxury editorial photography, ivory and champagne, not yellow, subtle soft shadow gradients. The upper central surface and lower center are clean unprinted paper. No wax seal (will be added as a separate animated object), no printed motifs, no embossing pattern, no swans, no animals, no text, no monograms, no hands, no phone frame, no border, no mockup, no ribbons, no flowers, no background. It must look like a real macro photograph of paper, not computer geometry.

### Exact final prompt: wax-lc-v3.webp

Use case: product-mockup. Asset type: transparent cutout photographic wax seal for a luxury wedding invitation, one separate animation layer. Extreme macro, straight-on overhead photograph of a genuine hand-poured champagne bronze sealing-wax stamp. Heavy uneven organic round edges, irregular tiny ripples where warm wax pooled, slightly imperfect raised circular rim, deep crisp pressed calligraphic initials exactly 'L & C' in the center. The letters are pressed into the wax, same bronze material, with realistic recessed shadows and highlights, NOT painted text. Warm soft daylight from upper left. Satin beeswax surface, restrained metallic bronze highlights, very fine micro scratches, real physical depth and thickness, elegant and tactile, never plastic or a perfect CGI cylinder. Single seal centered filling 85 percent of a square canvas. Genuinely transparent alpha background, only the seal with its own thin edge, no paper, no flowers, no props, no external cast shadow, no white backdrop, no checkerboard, no watermark. No swans or other motifs.

### Exact final prompt: flowers-ribbon-v3.webp

Use case: product-mockup. Asset type: transparent photographic foreground cutout for an interactive wedding invitation. A delicate loose diagonal sprig of ivory baby's breath with tiny real flowers and a few narrow muted olive leaves, accompanied by a single loose champagne silk ribbon curling naturally downward. Elegant airy asymmetric composition, sprig enters from upper-left corner and descends down the left side. All flowers and ribbon concentrated in leftmost third of a portrait canvas, entire right two thirds empty transparent alpha. Real macro editorial photography, warm neutral natural sunlight from upper left, detailed petal edges and silk weave, extremely shallow focus on nearest small blossoms with other blossoms crisply focused. Gentle romantic mood, subtle minimal arrangement. Genuinely transparent background. Only flowers, leaves, slender stems, and flowing silk, no vase, no surface, no paper, no envelope, no hands, no people, no phone, no text, no wax seal, no swans, no opaque background, no watermark.

### Exact final prompt: cotton-card-v4.webp

Use case: product-mockup. Asset type: a full-bleed photographic paper material for a premium wedding invitation card and envelope lining. Extreme macro of warm ivory handmade cotton-rag stationery paper, flat straight-on orthographic view, visible fine interwoven cotton fibers, tiny irregular natural flecks, subtle pressed texture and soft cream tonal variations. Fine elegant stationery grain, noticeably tactile but calm enough to set readable dark type on it. Soft neutral diffused daylight, uniform exposure across whole image. Square composition, paper fills all edges seamlessly. No folds, no envelope edges, no lettering, no print, no embossing motifs, no swans, no decoration, no shadows of objects, no gradients to black, no border, no watermark. Real paper macro photography.

Generated source: `/Users/lorenzoperez/.codex/generated_images/01a09a46-f2f9-7031-9e55-7ffb41143a2f/exec-18f1876d-b142-49ba-9f55-0c2362c6afae.png`. Delivery WebP prepared with Sharp.

## Verification notes

These recorded browser checks covered revision 4 at 390 × 844 and 1440 × 900, including the closed composition, replay, and intermediate envelope states. They do not certify the newer artwork or soundtrack. Current validation belongs in the showcase's current test and device evidence.

Physical iPhone, lower-powered Android, Messenger, and WhatsApp validation remains outstanding. Browser viewport checks do not establish physical-device performance or visual approval by the customer.

## Earlier scenery prompt set

### `olive-silk.webp`

Used behind the revealed stationery. The closed envelope still fills the screen without a surrounding background.

Photorealistic editorial overhead still life of deep olive silk with elegant folds, delicate white flowers around the edges, warm bronze accents, and a clear central area for an interactive envelope. Warm late-afternoon light, cinematic contact shadows, subtle film grain, no envelope, people, text, logos, or watermark.

### `bookshop.webp`

Refined editorial gouache-and-watercolor illustration of a Filipino couple meeting in an old-world Italian bookshop café. Lorenzo wears a cream shirt and olive trousers; Cham wears an elegant black dress. Warm window light, Tuscan street beyond, layered foreground foliage, no text, logos, panels, or watermark.

### `proposal.webp`

Identity-preserving continuation of the bookshop characters at a golden-hour Italian coastal proposal. Lorenzo kneels with a ring box; Cham reacts in an ivory dress. Maintain faces, proportions, palette, and textured editorial illustration style. Layered flowers and landscape, no text, logos, panels, or watermark.

### `villa.webp`

Wide Tuscan villa wedding reception in the same editorial illustration style, with linen tables, candles, ivory flowers, cypress trees, and a distant valley. The couple appears only as small silhouettes. Late-afternoon-to-evening light, layered foreground botanicals, no text, logos, modern signage, or watermark.

## Music

The earlier `canon-in-d-major.mp3` was removed. The current showcase loads `there-is-romance.mp3` and credits “There is Romance” by Kevin MacLeod under CC BY 4.0 in its footer. Keep `public/wedding-showcase/MUSIC-LICENSE.txt` aligned with the track used in code.
