# NOVA Current Stage Goals

## Current baseline

- Current version: `v0.6.10`.
- Current stage: product stabilization and defect correction.
- The browser extension remains the primary deliverable.
- npm SDK extraction, Web Components, and multi-framework adapters are deferred for now.

## Stage objective

Improve correctness, stability, and verifiability without expanding the architectural scope, creating a reliable baseline for the later platform extraction.

Priority areas:

1. Network Lab capture, rule creation, matching, Mocking, and real-response modification.
2. Consistent Fetch/XHR interception, hot rule synchronization, and hit-status feedback.
3. Pet action interruption, transitions, duration, hover isolation, bundled speech, and visual feedback.
4. Side Panel error boundaries, state recovery, and narrow-screen interaction.
5. Regression tests, type checks, and production builds for every confirmed defect.

## Stage constraints

- Every correction must cover the real runtime path rather than only changing the interface.
- Existing rules and local data remain backward compatible, with safe fallback when migration is required.
- Bug fixes must not prematurely split frameworks, replace renderers, or reorganize public directories.
- Domain code must not gain tighter coupling to Chrome APIs, Vue, Three.js, or an Agent provider.
- Every formal release updates version metadata, focused regressions, validation reports, and build artifacts together.

## Exit criteria

The project can enter `v0.7.0` when:

- Known critical interaction, animation, and Network Lab defects are closed.
- Manual creation, request-derived creation, editing, duplication, toggling, and deletion are stable.
- Fetch and XHR behave consistently for Mocking, delay, and whole-JSON response replacement.
- State is predictable after page refresh, extension reload, and Side Panel reopening.
- Critical paths have automated regressions and every workspace passes type checking and production builds.
- The browser extension is a stable reference implementation for platform extraction.

## Next stage

`v0.7.0` begins the SDK foundation phase:

- Extract a framework-independent pet state and action runtime.
- Define stable `NovaPet` lifecycle, event, and capability interfaces.
- Separate 3D rendering, Agent, themes, localization, and extension features into composable modules.
- Deliver the first standalone JavaScript and Web Component integrations.
- Gradually migrate the browser extension to consume the new core SDK.

## Final goal

NOVA ultimately becomes an independently published digital-pet Agent platform that can be integrated through npm, CDN, Web Components, and major frameworks, with replaceable character skins, localization, Agent providers, custom tools, and optional business plugins.

Until the current defect-correction stage is complete, this direction is recorded but remains outside immediate implementation scope.
