# NOVA Active Bug Backlog

> Current status: all six issues are implemented in `v0.6.7` and await final unpacked-extension browser regression.

## BUG-001: Loading orbit remains after opening a specific Side Panel view

- Status: completed (`v0.6.7`)
- Priority: P1
- Found in: `v0.6.6`
- Affected areas: in-page 3D pet, Side Panel navigation, and task-state feedback

### Reproduction

1. No audit, patch generation, project validation, or Agent request is running.
2. Open a specific Side Panel view through the pet's engineering actions; Network Lab is confirmed to reproduce the issue.
3. The Side Panel opens normally and the Network Lab master switch may remain disabled.
4. A loading orbit appears above the pet and never disappears.

### Actual result

Ordinary navigation is represented as an active task. The pet remains in a loading or thinking state even though no task exists.

### Expected result

- Opening the report, Network Lab, or Agent settings is navigation and must not enter a busy state.
- The loading orbit appears only while a real asynchronous task is running.
- Success, failure, cancellation, and an unconsumed Side Panel action must all restore a non-busy state.

### Preliminary location

These findings are recorded without implementing changes:

1. The page Content Script treats `network-lab` as a delegated task and writes `behavior: thinking` with `busy: true`.
2. A successful Side Panel open has no corresponding page-side reset.
3. The Side Panel consumes `network-lab` by switching workspaces and returning without explicitly synchronizing `busy: false`.
4. The 3D data orbit renders for either `behavior === thinking` or an active task, so a stale thinking behavior can also leave it visible forever.

### Suggested batch fix

- Separate navigation actions from real task actions.
- Report, Network Lab, and settings navigation always keep `busy: false`.
- Return an explicit completion state after the Side Panel consumes navigation.
- Drive the loading orbit only from a real running-task state, not a temporary menu behavior.
- Add completion, failure, and timeout recovery for cross-context tasks.

### Acceptance criteria

- Opening Network Lab never leaves a persistent loading orbit.
- Opening the report or Agent settings does not incorrectly enter a busy state.
- Real tasks such as patch generation and project checks still display loading feedback.
- Real tasks clear loading feedback after success, failure, or timeout.
- State remains consistent across repeated Side Panel opens, workspace switches, and page refreshes.

## BUG-002: Tail tip disappears against dark backgrounds

- Status: completed (`v0.6.7`)
- Priority: P2
- Found in: `v0.6.6`
- Affected areas: 3D pet materials, tail readability, and light/dark page adaptation

### Reproduction

1. Display the 3D pet on both a light page and a dark page.
2. Open the pet menu so the tail and tip are fully visible.
3. Compare the tail-tip color and silhouette across the two backgrounds.
4. On a dark background, the current tip color blends into the surrounding effects and becomes nearly invisible.

### Actual result

The tail tip lacks sufficient base color and luminance. Its glow primarily depends on motion or energy states, leaving no stable bright core during ordinary idle behavior and making the end of the tail difficult to identify on dark pages.

### Expected result

- Use a slightly brighter cyan or mint color for the tail tip.
- Keep a base glow active during idle, open menus, and ordinary motions.
- Special motions may intensify brightness and pulsing above the base glow, but ordinary states must never turn it fully off.
- Avoid overexposure on light pages while maintaining a clear silhouette on dark pages.

### Suggested batch fix

- Define a persistent minimum emissive intensity for the tail tip.
- Use a bright solid core with a softer translucent outer glow.
- Select a brighter cyan-white color that remains consistent with the existing cloud-fox palette.
- Make action-driven intensity additive above the base value instead of starting near zero.
- Validate contrast against white, light gray, dark gray, and black backgrounds.

### Acceptance criteria

- The tail-tip position and silhouette are immediately readable on dark backgrounds.
- The tip glows continuously at idle without flickering or disappearing intermittently.
- Motion-driven glow still has visible intensity levels despite the always-on base.
- The tip does not overexpose or obscure its connection to the tail on light backgrounds.
- Content Script and Playground pets render consistently.

## BUG-003: Motion thought panel is oversized and blocks interaction

- Status: completed (`v0.6.7`)
- Priority: P1
- Found in: `v0.6.6`
- Affected areas: motion feedback, menu interaction, and page usability

### Reproduction

1. Open the pet motion menu.
2. Select a motion with text feedback, such as Eating.
3. A large notification-sized panel appears near the upper-left area.
4. The panel covers menu controls, page content, or clickable regions and includes minimize and close controls.

### Actual result

Motion copy is presented through the large task/notification panel. It occupies too much space, blocks content, and does not behave like a lightweight thought bubble.

### Expected result

- Motion copy appears in a small thought bubble near the pet's head.
- The bubble contains only the motion title and one or two short lines.
- It has no minimize, close, or other controls.
- It never captures pointer events or blocks the radial menu's primary interaction area.
- It fades automatically after a short duration; if safe placement is unreliable, it may be omitted entirely.

### Suggested batch fix

- Separate motion feedback from audit/task notifications into distinct components and state channels.
- Anchor the small bubble to the pet's head and flip it left or right near viewport edges.
- Use a small maximum width, two-line truncation, short fades, and `pointer-events: none`.
- Replace the current bubble when motions change instead of stacking messages.
- Reserve the large panel for audit, error, and task results that require reading or interaction.

### Acceptance criteria

- Triggering a motion never displays the large panel shown in the screenshot.
- The small bubble does not cover the motion menu or important page controls.
- It cannot be clicked or focused and disappears automatically.
- Rapid motion changes never create stacked bubbles.
- The bubble may be hidden when safe placement is impossible on narrow screens or page edges.

## BUG-004: Motion audio is a notification beep instead of spoken copy

- Status: completed (`v0.6.7`)
- Priority: P1
- Found in: `v0.6.6`
- Affected areas: motion feedback, sound design, and future localization

### Actual result

Motions use synthesized Web Audio beeps or pitch changes. The sound has no semantic relationship with the motion or its on-screen copy.

### Expected result

- Every retained motion speaks the copy mapped to that motion.
- The voice is cute and gentle, fitting the digital-pet character rather than a system notification.
- Spoken content and displayed copy remain consistent.
- Re-selecting the current motion does not replay speech.
- When a new motion interrupts the old one, old speech stops and audio never overlaps.
- If speech is unavailable, remain silent instead of falling back to a beep.

### Candidate implementation options

The voice source must be selected before implementation:

1. Bundled pre-generated voice assets provide consistent offline sound but increase package size and require a confirmed generation and licensing path.
2. Browser `speechSynthesis` requires no plugin, but voices vary by operating system and cannot guarantee a cute character voice.
3. An optional TTS provider offers higher quality and localization but requires networking, credentials, and a Provider Adapter.

If the selected approach requires an external voice-generation plugin or service, user approval and plugin installation must happen before generating or integrating voice assets.

### Suggested default policy

- Speak only for manually triggered motions.
- Keep automatic idle motions silent by default to avoid interrupting reading.
- Provide global mute and volume controls and respect browser autoplay restrictions.
- Map copy through localization keys so future language voice packs remain possible.

### Acceptance criteria

- Eating speaks matching cute copy and never emits a notification beep.
- Every retained motion has an explicit copy-to-voice mapping.
- New motion speech never overlaps the previous motion.
- Muting, playback failure, and browser restrictions never trigger a beep fallback.
- No unapproved external plugin or voice service is installed or called.

## BUG-005: Request list lacks resource-type categories and filters

- Status: completed (`v0.6.7`)
- Priority: P1
- Found in: `v0.6.6`
- Affected areas: Network Lab request list, network analysis efficiency, and filtering UX

### Current result

The Requests view only provides text filtering by URL, method, or status code plus a slow-request toggle. Large captures mix every resource into one list, so APIs, scripts, styles, images, and WebSockets cannot be isolated as they can in the browser DevTools Network panel.

### Expected result

- Add a resource-type quick-filter row near the request search controls.
- Start with categories close to the common DevTools Network set: `All`, `Fetch/XHR`, `Doc`, `CSS`, `JS`, `Font`, `Img`, `Media`, `Manifest`, `Socket`, `Wasm`, and `Other`.
- Each filter may show the number of matching requests in the current capture, updating as requests arrive or the capture is cleared.
- Selecting a resource type filters only the rendered list; it must not change the total request count or underlying capture data.
- Type filtering composes with the existing text query and slow-request filter.
- Request details display the final normalized resource type so classification can be verified.

### Suggested batch implementation

- Add a stable `resourceType` field to the captured-request model instead of guessing only from file extensions during rendering.
- Prefer browser-provided request types and normalize Fetch, XHR, WebSocket, and Performance API signals.
- When the browser does not provide a definitive type, consider request source, `Content-Type`, URL suffix, and response headers in that order, then fall back to `Other`.
- Define one shared type enum and localized display mapping so Content Script, background capture, and Side Panel do not maintain divergent rules.
- Allow horizontal scrolling or wrapping in the category row without squeezing the search box or overflowing the Side Panel.
- Keep the model extensible for later secondary filters such as method, status, intercepted, or modified.

### Acceptance criteria

- Fetch and XHR requests both appear under `Fetch/XHR`.
- HTML documents, CSS, JavaScript, fonts, images, audio/video, manifests, WebSockets, and Wasm are categorized correctly.
- Unrecognized requests consistently appear under `Other` and never disappear from the list.
- Type, text, and slow-request filters produce correct combined results.
- Category counts update immediately when requests arrive, navigation occurs, or records are cleared.
- Switching categories remains responsive with 300 or more requests and never duplicates or drops captured requests.

## BUG-006: Page Audit lacks issue categories and audit-scope controls

- Status: completed (`v0.6.7`)
- Priority: P1
- Found in: `v0.6.6`
- Affected areas: audit configuration, audit execution, report scoring, and issue lists

### Current result

Page Audit always runs every rule. After completion, findings can only be filtered by high, medium, or low severity. Users cannot browse by issue category or disable irrelevant audit categories before execution.

### Expected result

- Add a multi-select Audit Scope control near the Run Page Audit action.
- Start with the categories already defined by the audit domain model: `Performance`, `Accessibility`, `SEO`, `Best Practices`, and `DOM / Page Structure`.
- Give each category an independent checkbox, with all categories selected by default.
- Unchecked categories must be skipped by the audit pipeline: their rules do not run and produce no findings.
- Add category filters to the report issue list and compose them with the existing high, medium, and low severity filters.
- Clearly show the categories actually enabled for each report so “not checked” cannot be mistaken for “no issues found.”

### Suggested batch implementation

- Add `enabledCategories` to the audit request sent from the Side Panel and pet shortcut to the Content Script.
- Register audit rules by category and check category enablement before invoking each rule instead of running everything and filtering afterward.
- Always collect only metrics required for the base report; skip category-specific heavy collection when its category is disabled.
- Calculate score, total findings, and severity summaries only from enabled categories.
- Store the executed scope in `AuditReport` so reports, issue navigation, re-audits, and Local Agent patch context remain consistent.
- Persist the user's latest category selection and provide Select All and Restore Defaults actions.
- Disable Run Page Audit with an explanatory message when no category is selected.
- Pet double-click audits use the latest saved scope, with all categories enabled on first use.

### Acceptance criteria

- Disabling Performance prevents performance rules from running, removes performance findings, and excludes performance penalties from the score.
- Selecting only Accessibility runs and displays only accessibility rules and findings.
- Re-enabling a category restores its checks in the next audit.
- Category and severity filters compose correctly and affect only presentation, not the generated report.
- Reports identify both checked and unchecked categories; unchecked categories are never represented as zero findings or a pass.
- Side Panel audits, pet double-click audits, and re-audits use one consistent scope configuration.
- With every category unchecked, no empty audit starts and the pet never enters a stuck busy state.

## Batch result

`BUG-001` through `BUG-006` are included in `v0.6.7`.

## v0.6.8 follow-up result

- `BUG-007`: transparent tail-tip layers looked gray on dark backgrounds. The tip now uses an opaque bright core, a persistent additive aura, and multi-color flashing during high-energy motions.
- `BUG-008`: motion speech used media-element playback and silently swallowed failures. Speech now uses prefetching, Web Audio decode caching, and audio-context resume from the user click, with no notification-beep fallback.
- `BUG-009`: the small motion thought bubble distracted from page content. Motion bubbles are removed, leaving animation and matching speech.
- `BUG-010`: Page Audit could only toggle broad categories. All 16 child rules now have independent selection, persistence, report scope, and pre-execution gating.

`BUG-007` through `BUG-010` are included in `v0.6.8`. New findings continue from `BUG-011`.

## v0.6.9 audio hotfix

- `BUG-011`: all 18 v0.6.8 MP3 containers decoded correctly, but their waveform peaks were only `-91 dB`, making them effectively silent. The offline synthesizer had used an invalid Chinese voice identifier.
- Every line was regenerated with a valid Chinese voice, a subtle pitch lift, loudness normalization, and high/low-frequency cleanup.
- A new audio-content check validates decoding, duration, mean volume, and peak volume for every file, preventing silent assets from entering another release.

`BUG-011` is included in `v0.6.9`. New findings continue from `BUG-012`.

## v0.6.10 multi-voice result

- `BUG-012`: one offline electronic voice cannot fit every user's taste. The asset is retained and formally named Nebula Alien, with Cute Girl, Cute Companion, and Mute added alongside it.
- Cute presets use Chinese TTS voices installed through Chrome or the operating system instead of further processing the previous offline robot voice. The background prioritizes voices whose names indicate natural, neural, or common Chinese feminine voices.
- The Side Panel supports persistent selection and immediate preview. The in-page pet switches as soon as storage changes while preserving one matching line per motion.
- No specific anime character voice is copied. Cute Companion uses only generic anime-pet pitch and rate parameters.

`BUG-012` is included in `v0.6.10`. New findings continue from `BUG-013`.
