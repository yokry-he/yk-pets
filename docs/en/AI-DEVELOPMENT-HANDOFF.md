# AI Development Handoff

## 1. Repository and collaboration boundaries

- Repository: `yokry-he/yk-pets`
- Sole development branch: `agent/cloud-fox-studio-v0610`
- Pull request: #7
- Base branch: `agent/yk-pets-rebrand-v0610`
- Do not merge without an explicit user request.
- Every independent feature batch must run the full CI workflow. Update the PR only after it is green.

A new session must verify the current HEAD, PR state, and latest complete CI directly from GitHub. This document intentionally does not store a live SHA.

## 2. Current product architecture

YK-PETS Studio uses one product shell with four routed workspaces:

- `/studio/appearance`: Appearance Studio;
- `/studio/motion`: Motion Studio;
- `/studio/props`: Prop Studio;
- `/studio/library`: shared Asset Library.

`/studio` only redirects for compatibility. The workspaces share locally persisted appearance, motion, prop, view, and background selections while keeping editor-specific undo state independent.

The sole production Cloud Fox composition is:

`apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue`

The shared preview entry is:

`apps/playground/app/components/studio/CloudFoxStudioCanvas.vue`

Motion and prop authoring must not copy a second pet topology or create another continuously running WebGL scene.

## 3. Completed capabilities

### Appearance Studio

- Independent head and body shapes;
- complete front-paw, hind-leg, and hind-paw customization;
- belly projected onto the real body surface;
- eyes and muzzle anchors sampled from the real head surface;
- configurable nose, five mouth styles, ears, tail, antennae, colors, glow, orbit, and chest/back symbols;
- one numeric control registry;
- undo/redo, automatic drafts, local schemes, import/export, and extension synchronization;
- deterministic visual audit routes and numeric geometry regression.

### Unified Studio foundation

- Shared top navigation and context;
- local StudioSession;
- stable motion and prop asset IDs;
- motion and prop metadata store;
- shared library and contextual jumps.

### Motion Studio foundation

Asset creation and selection, Chinese and English names, duration, loop mode, semantic track list, timeline tick foundation, active-appearance preview, and prop dependency entry are complete.

### Prop Studio foundation

Composite/effect prop assets, default mounts, `origin`, `grip`, `display`, and `emitter` anchors, hierarchy foundation, and Motion Studio testing jumps are complete.

## 4. Explicitly not implemented

The following are not implemented and must not be described as complete in UI, documentation, PR text, or assistant responses:

- semantic motion Rig;
- writing, moving, copying, or deleting keyframes;
- auto-key and manual pose capture;
- track interpolation and curve editing;
- custom motion playback runtime;
- prop event tracks;
- prop geometry and material editors;
- grip and emitter manipulators;
- browser screenshot baselines;
- real Chrome Side Panel, GPU, and WebGL manual acceptance.

## 5. Next phase

The next phase is `motion-semantic-rig-and-keyframe-domain`:

1. Define stable semantic Rig channels.
2. Store time in milliseconds while allowing an FPS grid in the UI.
3. Store pose offsets relative to the base appearance instead of mutating appearance recipes.
4. Define tracks, keyframes, interpolation, and normalization domains.
5. Cover body, head, front and hind paws, ears, eyes, mouth, tail, and antennae with testable channels.
6. Complete the domain and numeric tests before wiring the timeline UI and production preview.

## 6. Safety and performance boundaries

Do not add:

- Chrome permissions;
- network uploads;
- continuous background polling;
- duplicate WebSockets;
- persistent configuration DOM in host pages;
- a second Cloud Fox renderer;
- another continuously running WebGL scene.

## 7. Mandatory AI package update policy

Every feature commit must update both:

1. `.ai/project-state.json`;
2. at least one context file: session protocol, visual cases, handoff, known issues, roadmap, or a relevant ADR.

`scripts/check-ai-handoff.mjs` enforces this per commit. Feature code and its AI handoff update cannot be split into separate commits.

## 8. Trust order

Actual code and runtime results > latest complete CI > machine-readable project state > accepted ADRs and handoff documents > PR description > old chat history.
