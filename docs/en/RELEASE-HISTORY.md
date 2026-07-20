# NOVA Release and Validation History

This document consolidates the per-version release notes, focused design records, and validation reports that were previously scattered across the repository root and `docs/en`. It keeps the conclusions that remain useful for maintenance and release work. The original process records can still be recovered from the `v0.6.10` tag or Git history.

## Current stable baseline

- Extension version: `v0.6.10`;
- Deliverable: Chrome/Edge Manifest V3 extension;
- Core stack: WXT, Vue 3, Three.js, TresJS, and TypeScript;
- Local collaboration: token-authenticated WebSocket Agent;
- Unpacked build: `apps/extension/.output/chrome-mv3`;
- Store ZIP: `apps/extension/.output/novaextension-0.6.10-chrome.zip`.

## Version evolution

| Version | Main change | Validation focus |
|---|---|---|
| `v0.2.6` | On-demand status notices, motion restart, and idle suspension. | Notice rules, motion bridge, production JavaScript, and ZIP integrity. |
| `v0.2.7` | Chinese motion menu, full-body framing, four paws, contact shadow, and natural turning. | Pet contracts, nebula, tail, motion controls, and Chrome package assertions. |
| `v0.2.9` | Fixed the Function/Motion switcher anchor so notices no longer moved it. | Controller placement and page-interaction regression. |
| `v0.3.0` | Pet thought bubble and page-audit entry points. | Bubble stacking, audit state, and finding navigation. |
| `v0.3.1` | Unified menu opening, closing, mode switching, and motion-button behavior. | Click, double-click, context-menu, and menu-state regression. |
| `v0.3.2` | Function, Motion, and Engineering modes backed by an extensible registry. | Registry, pagination, and capability grouping. |
| `v0.3.3` | Minimal current-mode icon and six-slot menu. | Expansion, collapse, tooltips, and mode persistence. |
| `v0.4.0` | Lifestyle motions, prop interaction, and layered idle scheduling. | Motion registration, prop lifecycle, and idle policy. |
| `v0.4.1` | Front-paw and prop alignment, rebuilt directly from source. | Vue/TresJS source, WXT type checking, and production build. |
| `v0.4.2` | Outward tail posture, stable paw roots, and consistent menu colors. | Model posture, motion baselines, and three-mode visual regression. |
| `v0.4.3` | Greeting, stretching, gaze tracking, and eating fixes. | Stable shoulders, target gaze, and pointer direction. |
| `v0.5.0` | Network Lab with request capture, performance analysis, Fetch/XHR Mocking, and a per-site master switch. | Network-domain tests, workbench tests, and page bridge. |
| `v0.5.1` | Full-page Mock rule workbench, conflict checks, and high-energy motions. | Rule creation, duplication, testing, conflicts, and motion regression. |
| `v0.5.2` | Bilingual documentation, responsibility comments, and release guidance. | Bilingual docs, source headers, and build-document gates. |
| `v0.6.0` | High-altitude fireworks, pet vitality, random easter eggs, and request details. | 15/15 focused checks, network and Mock regressions, WXT build, and ZIP. |
| `v0.6.1` | Motion queue, active glow, and side-lying cloud nap. | Motion interruption, hover isolation, animation recovery, and type checking. |
| `v0.6.2` | Motion switching and Mock editor fixes. | Rule editing, idle orbit, and motion-switching regression. |
| `v0.6.3` | Rule creation, motion speech, and thought feedback. | Motion feedback, rule creation, and cross-context state. |
| `v0.6.4` | Nested rule-editor Proxy and new-rule test fixes. | Rule serialization, nested editing, and network-rule creation tests. |
| `v0.6.5` | Fetch Mock interception fix. | Fetch/XHR consistency, hit state, and restoration of real requests. |
| `v0.6.6` | Whole-JSON real-response editing. | Full-body capture, 512 KB limit, Fetch/XHR replacement, and build. |
| `v0.6.7` | Audit scope, network resource categories, and pet-feedback fixes. | Audit, network, and pet-feedback regressions. |
| `v0.6.8` | Sixteen audit child rules, solid tail-tip core, and motion-speech playback chain. | Rule scope, visual, and speech regression. |
| `v0.6.9` | Regenerated 18 silent MP3 assets and added audio-content gates. | Decode, duration, mean-volume, and peak-volume checks for all 18 files. |
| `v0.6.10` | Nebula Alien, Cute Girl, Cute Companion, and Mute voice presets. | Voice 10/10, audit/network 14/14, visual/speech 12/12, motion 16/16, audio 18/18; type checks, Chrome build, and ZIP passed. |

## Current validation commands

Run from the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check:documentation
pnpm typecheck
pnpm test
pnpm test:network-domain
pnpm test:network-workbench
pnpm build:agent
pnpm build:playground
pnpm build:extension
pnpm zip:extension
```

Do not continue a release after any gate fails.

## Manual regression that remains required

Automation cannot fully replace these browser checks:

- inspect the pet, tail tip, menus, and dragging on light and dark pages;
- verify motion interruption, idle motions, background-tab suspension, and reduced-motion behavior;
- verify audit scope, finding navigation, and reversible preview;
- verify Fetch/XHR Mocking, delays, and whole-JSON modification;
- verify Local Agent connection, confirmation, validation, and rollback;
- preview Cute Girl and Cute Companion on the current system and record the Chinese TTS voice selected by Chrome.

System-based cute voices depend on voices installed on the device. Automation can validate the invocation chain and parameters but cannot guarantee identical perceived quality across operating systems.

## Recording policy for future versions

- Do not add `RELEASE-NOTES-vX.Y.Z.md` or `VALIDATION-vX.Y.Z.*.md` files to the repository root;
- update this document, project status, package/Manifest versions, and affected operational guides;
- keep Chrome ZIPs, source archives, SHA-256 files, and user-facing release notes in GitHub Releases or the release system;
- retain version-specific automation scripts only while they remain active regression gates, never solely as one-time upgrade records.
