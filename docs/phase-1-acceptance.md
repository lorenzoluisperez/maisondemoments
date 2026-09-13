# Phase 1 guest-experience acceptance

## Implemented proof

- The invitation is one naturally scrollable document. Opening the seal scrolls forward but never gates content.
- Details and RSVP stay available from the fixed navigation throughout the journey.
- All eight event and collection presets use the same semantic renderer.
- Midnight Garden and Luminous Parchment use separate original artwork files and distinct compositions.
- Long participant lists increase the document height and never enter a fixed-height inner scroller.
- Animation is progressive enhancement. Content is readable before animation starts, after animation failure, and under reduced motion.
- Every gesture has a button or ordinary scrolling equivalent.
- Venue links, RSVP controls, text, and navigation remain real HTML elements.

## Automated release checks

- Four strict event schemas and all eight snapshots compile deterministically.
- Long debut participant fixtures render without truncation.
- Lint, TypeScript, domain tests, production build, and route smoke tests pass.
- Critical artwork files stay within the proposed 300 KiB visual budget.

## Physical-device release gate

The browser implementation is ready for this gate, but emulation cannot satisfy it. Before accepting paid orders, record a pass on:

1. Current iPhone Safari.
2. Lower-powered Android Chrome.
3. Messenger and WhatsApp in-app browsers used by the target audience.
4. Approximately 1.6 Mbps, 300 ms latency, and slowed CPU.
5. Portrait, landscape, 200% text zoom, reduced motion, and failed-image conditions.

A pass means useful event information appears within five seconds, natural scrolling never becomes trapped, Details and RSVP work without completing motion, and an RSVP confirmation is never shown before a successful save.
