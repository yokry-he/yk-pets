# NOVA Current Project Status

## Current baseline

- Current version: `v0.6.10`;
- Primary deliverable: Chrome/Edge Manifest V3 browser extension;
- Current phase: product stabilization, browser regression, and defect correction;
- npm SDK extraction, Web Components, and multi-framework adapters remain outside the current implementation scope.

## Working principles

- Fixes must cover the real runtime path rather than only changing presentation;
- Existing rules and local data remain backward compatible;
- Domain code must not depend on Vue, Chrome APIs, the DOM, or a concrete Agent provider;
- Formal releases update version metadata, regressions, validation reports, and build artifacts together;
- State must remain predictable after page refresh, extension reload, and Side Panel reopening.

## Resolved issues

| ID | Included in | Result |
|---|---|---|
| BUG-001 | v0.6.7 | Ordinary Side Panel navigation no longer leaves a loading orbit or stale busy state. |
| BUG-002 | v0.6.7 | The tail tip keeps a readable bright core and aura on dark pages. |
| BUG-003 | v0.6.7 | Motion feedback is separated from large task notifications and no longer blocks page interaction. |
| BUG-004 | v0.6.7 | Motions use speech that matches their copy, with no notification-beep fallback. |
| BUG-005 | v0.6.7 | Request capture has stable resource categories and composable filters. |
| BUG-006 | v0.6.7 | Page Audit supports scope selection, result filtering, and executed-scope records. |
| BUG-007 | v0.6.8 | The tail tip uses an opaque bright core, persistent additive aura, and multicolor high-energy flashes. |
| BUG-008 | v0.6.8 | Motion speech uses prefetching, Web Audio decode caching, and user-gesture audio-context recovery. |
| BUG-009 | v0.6.8 | Motion thought bubbles were removed, leaving animation and matching speech. |
| BUG-010 | v0.6.8 | All 16 audit child rules support independent selection, persistence, and pre-execution gating. |
| BUG-011 | v0.6.9 | Silent MP3 assets were regenerated and protected by decode, duration, and loudness checks. |
| BUG-012 | v0.6.10 | Nebula Alien, Cute Girl, Cute Companion, and Mute presets were added with persistence and preview. |

New findings continue from `BUG-013`. Detailed implementation and validation records remain in the [version history](../README.md#version-history--版本历史) and root validation reports.

## Exit criteria

- Critical interaction, animation, and Network Lab fixes pass unpacked-extension browser regression;
- Manual creation, request-derived creation, editing, duplication, toggling, and deletion are stable;
- Fetch and XHR behave consistently for Mocking, delay, and whole-JSON response replacement;
- Critical paths have automated regressions;
- Every Workspace passes type checking, tests, and production builds;
- `v0.6.10` is a stable reference implementation for later platform extraction.

## Next-stage direction

After stabilization, the project can begin the SDK foundation phase: extract framework-independent pet state and motion runtime, define stable lifecycle and capability interfaces, and gradually separate rendering, Agent, themes, localization, and extension features.
