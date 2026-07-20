# NOVA Browser Agent v0.6.7 Validation Report

## Core scenarios

- Workspace navigation never enters or leaves behind task-busy state, and the 3D loading orbit appears only for real tasks.
- Page Audit executes a five-category checkbox scope, skips unchecked rules before invocation, and stores the executed scope in each report.
- Network requests support DevTools-style resource categories, live counts, and composed filters.
- Motion copy uses a non-interactive small bubble, while 18 manual motions use bundled Chinese speech with no notification beep.
- The tail tip remains visibly lit and continuously changes color during related motions.

## Automated results

- v0.6.7 focused static regression: 14/14.
- Existing page-interaction, motion, Mock, Fetch, whole-JSON, menu, and documentation regressions all pass.
- Network Domain: 22 assertions passed.
- Network Workbench: 18 assertions passed.
- Rule-creation and whole-JSON runtime regressions pass.
- Shared, Extension, Local Agent, and Playground type checks pass.
- Local Agent: 2 tests passed.
- Extension, Local Agent, and Playground production builds pass.
- All 18 bundled MP3 files pass full decoding and are present in the Chrome build output.
- The Chrome MV3 manifest reports `0.6.7`, with speech files declared as web-accessible extension resources.

## Known build notice

The Playground Three.js/TresJS client chunk remains larger than 500 KB. This is unchanged from earlier releases and does not affect the extension build, the Page Audit Content Script, or this batch.

## Manual confirmation after installation

Automated checks cannot replace interaction in a real Chrome tab. After reloading v0.6.7 and refreshing the target page, confirm the following:

1. Open Network Lab and verify that the pet never keeps a permanent loading ring.
2. Run audits with one category selected at a time and verify report scope and finding categories.
3. Check request categories on a page with images, scripts, APIs, and a WebSocket.
4. Switch rapidly between two motions and verify that the small bubble does not block controls, old speech stops, and no beep plays.
5. Check the always-on tail tip on a dark page, then run Tail Glow or Tail Tornado and verify continuous multicolor flashing.
