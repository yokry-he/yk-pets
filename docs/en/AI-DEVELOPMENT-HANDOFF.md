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

The framework-neutral motion contract lives in:

`packages/pet-core/src/motion/`

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
- shared asset library and contextual jumps;
- one production Cloud Fox renderer and preview entry.

### Semantic Rig and keyframe domain

- Stable `cloud-fox-semantic-rig/v1` semantic Rig;
- root, body, head, front and hind paws, ears, eyes, mouth, tail, and antenna channels;
- millisecond storage with independent `displayFps` metadata;
- schema v2 motion, track, and keyframe structures;
- local pose offsets relative to base appearance mounts and scale;
- track merging, keyframe sorting, range clamping, and last-input-wins duplicate-time handling;
- basic `step` and `linear` interpolation;
- `once`, `loop`, and `ping-pong` time resolution;
- a complete UI-free, Vue-free, and Three.js-free pose evaluator;
- a programmatic keyframe insertion API and deterministic numeric tests;
- local migration from `yk-pets:studio:assets:v1` to `yk-pets:studio:assets:v2`;
- migration of `appearanceId` to trace-only `authoringAppearanceId`, which never participates in evaluation.

### Current Motion Studio UI

Motion Studio can create and select assets, edit bilingual names, millisecond duration, FPS display metadata, loop mode, and prop dependencies, and show read-only semantic Rig groups. The preview still plays the existing idle behavior and does not evaluate custom tracks.

### Prop Studio foundation

Composite/effect prop assets, default mounts, `origin`, `grip`, `display`, and `emitter` anchors, hierarchy foundation, and Motion Studio testing jumps are complete.

## 4. Explicitly not implemented

The following are not implemented and must not be described as complete in UI, documentation, PR text, or assistant responses:

- writing, moving, copying, deleting, or multi-selecting keyframes on the timeline;
- auto-key and manual pose capture;
- playhead, playback controls, and duration scaling;
- smooth or Bézier interpolation and curve editing;
- the semantic-pose adapter for the production Cloud Fox components;
- custom-motion production playback;
- final blending with procedural breathing, blinking, gaze, and expressions;
- prop event tracks;
- prop geometry and material editors;
- grip and emitter manipulators;
- browser screenshot baselines;
- real Chrome Side Panel, GPU, and WebGL manual acceptance.

A programmatic keyframe insertion function in the domain does not mean users can already write keyframes on the timeline.

## 5. Motion asset and consumption chain

The current motion asset schema is v2:

- `rigId`: fixed to `cloud-fox-semantic-rig/v1`;
- `durationMs`: the sole persisted time unit;
- `displayFps`: UI display and snapping metadata only;
- `authoringAppearanceId`: authoring context only, never an appearance binding;
- `tracks`: stored by stable semantic channels;
- `keyframes`: integer milliseconds, value, and outgoing interpolation.

The future production consumption chain must be:

`StudioMotionAssetV2 -> normalizeMotionAsset -> resolveMotionTime -> evaluateNormalizedMotionAsset -> EvaluatedCloudFoxPose -> CloudFoxStudioCanvas -> ProceduralPet -> ExtensionAlignedCloudFox -> semantic part adapters`

Evaluate once per frame. Adapters may read appearance mounts and proportions to convert normalized offsets, but must never mutate the appearance recipe.

## 6. Legacy compatibility

- Read `yk-pets:studio:assets:v2` first.
- When v2 is absent, read v1, normalize it in memory, and persist v2.
- Do not automatically delete v1, preserving rollback capability.
- Preserve legacy IDs, names, durations, loop modes, prop dependencies, and timestamps.
- Empty-track motions evaluate to a complete neutral pose.
- The thirty built-in motions remain read-only and their runtime is unchanged.

## 7. Next phase

The next phase is `motion-timeline-authoring-and-preview-adapter`:

1. Establish an independent motion-editing draft and undo model.
2. Add a playhead and basic playback controls.
3. Add, delete, copy, and move keyframes.
4. Reuse the existing normalizer for conflicts and range validation.
5. Build a single-evaluation, multi-consumer production pose adapter.
6. Define blending between custom poses and idle breathing, blinking, and gaze.
7. Complete refresh restoration and custom playback without prop events before starting prop-event tracks.

Do not start with a complex curve editor or prop events.

## 8. Safety and performance boundaries

Do not add:

- Chrome permissions;
- network uploads;
- continuous background polling;
- duplicate WebSockets;
- persistent configuration DOM in host pages;
- a second Cloud Fox renderer;
- another continuously running WebGL scene.

## 9. Mandatory AI package update policy

Every feature commit must update both:

1. `.ai/project-state.json`;
2. at least one context file: session protocol, visual cases, handoff, known issues, roadmap, or a relevant ADR.

`scripts/check-ai-handoff.mjs` enforces this per commit. Feature code and its AI handoff update cannot be split into separate commits.

## 10. Trust order

Actual code and runtime results > latest complete CI > machine-readable project state > accepted ADRs and handoff documents > PR description > old chat history.
