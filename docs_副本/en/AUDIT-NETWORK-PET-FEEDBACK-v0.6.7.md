# NOVA v0.6.7: Audit Scope, Network Categories, and Pet Feedback Fixes

## Release goal

v0.6.7 closes the six issues collected during the v0.6.6 stabilization phase, covering Side Panel task state, Page Audit scope, Network request categories, motion bubbles, bundled speech, and tail-tip visibility.

## Task state

- Network Lab, full reports, and Agent settings are navigation actions and no longer write task-busy state.
- The Side Panel explicitly synchronizes `busy: false` after consuming navigation.
- The 3D data orbit is driven only by real task state; an ordinary `thinking` motion never creates a loading ring.
- Audits, patches, and project checks still reset state across success, failure, and exception paths.

## Page Audit scope

- Audit Scope provides checkboxes for Performance, Accessibility, SEO, Best Practices, and DOM / Page Structure.
- Unchecked categories are skipped before rule invocation instead of running and hiding results afterward.
- Reports store `enabledCategories`; scores, totals, and severity summaries use only the executed scope.
- Reports distinguish checked from unchecked categories and combine category filters with severity filters.
- The latest scope is saved in Chrome Storage, and pet double-click audits reuse the same scope.
- An empty selection never starts an empty audit.

## Network request categories

The Requests view now has live-count filters for All, Fetch/XHR, Doc, CSS, JS, Font, Img, Media, Manifest, Socket, Wasm, and Other.

- Type filtering composes with text queries, method/status text, and the slow-request filter.
- Document navigation is recorded through Navigation Timing.
- WebSocket capture records connection success or failure without reading or modifying message frames.
- Manifest and Wasm are normalized from request source, URL, and response type.
- Request details show the final resource type, while unknown requests consistently remain under Other.

## Lightweight motion bubble and bundled speech

- Motion copy no longer reuses the large audit notice; it appears in a small bubble near the pet's head.
- The bubble is limited to two lines, fades automatically, and uses `pointer-events: none`, so it never blocks the menu or page.
- Each of the 18 retained motions maps to a bundled Chinese MP3 whose meaning matches the displayed copy.
- Speech ships offline with the extension and never calls an online TTS service at runtime.
- Only manually triggered motions speak; automatic idle motions remain silent.
- Re-selecting the active motion does not replay speech, a new motion stops old speech, and playback failure stays silent instead of falling back to a beep.

## Tail-tip glow

- The tail tip uses a brighter cyan-white core with a persistent emissive base and outer aura.
- Tail Glow, Tail Tornado, Energy Burst, Star Juggle, and Fireworks continuously cycle through multiple colors while active.
- Reduced-motion mode disables rapid color cycling while preserving a stable bright tail tip.

## Compatibility

- Legacy reports without an audit-scope field are read as having checked every category.
- Existing Network rules and saved request structures remain compatible; resource kinds are extended only.
- No remote runtime service, secret, or new Chrome permission is introduced.
