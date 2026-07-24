# AI Development Roadmap

This roadmap restores development order in a new session and does not replace live GitHub state. Every phase must update the AI handoff package in the same feature commit and pass the full CI workflow.

## Phase A: Semantic Rig and keyframe domain

- Status: domain implementation complete, pending full CI and manual browser migration acceptance
- Goal: establish motion data that is independent from concrete Three.js meshes.

Completed:

- Stable semantic channels for the root, body, head, front and hind paws, ears, eyes, mouth, tail, and antennae.
- Millisecond persistence with FPS used only as display and snapping metadata.
- Schema v2 motion, track, keyframe, loop, and normalization contracts.
- Pose offsets relative to base appearance mounts and scale.
- Duplicate-track merging, keyframe sorting, last-input-wins duplicate times, and range clamping.
- `step` and `linear` interpolation.
- `once`, `loop`, and `ping-pong` time evaluation.
- A complete UI-free semantic-pose evaluator.
- v1-to-v2 local asset migration.
- Deterministic domain tests and architecture gates.

Completion criterion: without a UI, code can create a motion asset, insert keyframes, and evaluate a complete pose at any time. Domain tests now cover this criterion.

Manual acceptance still required: migration, refresh restoration, and rollback with real legacy v1 browser data.

## Phase B: Timeline editing and production preview

- Status: Next

Recommended order:

1. Establish a motion-editing draft with independent undo and redo.
2. Add a playhead and basic playback controls.
3. Add, delete, copy, move, and multi-select keyframes.
4. Reuse domain normalization for duplicate times, ranges, and duration changes.
5. Pass one `EvaluatedCloudFoxPose` per frame into the sole production preview.
6. Build semantic adapters for the root, body, head, front and hind paws, ears, eyes and mouth, tail, and antennae.
7. Keep breathing, blinking, and gaze on unauthored channels while applying semantic override or additive blending on authored channels.
8. Complete save, refresh restoration, and custom playback without prop events.

This phase uses only `step` and `linear`. Smooth, Bézier, and curve editing stay in the advanced phase.

Completion criterion: a user can create, save, refresh, restore, and play a complete custom motion without prop events, without copying the renderer or adding another long-running WebGL scene.

## Phase C: Prop event tracks

- Reference props by stable asset ID.
- Create, show, attach, detach, move, hide, and destroy events.
- Convert between world space and pet mounts.
- Animate color, size, glow, and particles.
- Validate missing dependencies and deletion cleanup.

Completion criterion: deterministic hold, throw, catch, and effect-prop motions can be authored.

## Phase D: Prop Studio entity editing

- Compose parameterized primitive geometry.
- Edit hierarchy and local transforms.
- Edit material, color, opacity, metalness, roughness, and glow.
- Manipulate `origin`, `grip`, `display`, and `emitter` anchors.
- Preview, duplicate, import/export, and enforce resource budgets.

Completion criterion: users can create local parameterized props without remote assets and reference them reliably from motions.

## Phase E: Advanced animation tools

- Smooth and Bézier interpolation.
- Curve editor.
- Onion skinning.
- Motion paths.
- Left/right mirroring and pose presets.
- Motion layers and interruption policy.
- Optional IK assistance.
- Audio tracks.
- Local GLB prop import only after security and performance review.

## Mandatory process for every phase

1. Verify the AI package, code, PR, and latest CI before editing.
2. State scope and acceptance criteria.
3. Commit feature code and AI package updates together.
4. Update tests and architecture gates.
5. Run full CI.
6. Update the PR only after green.
7. Preserve real-browser and WebGL manual acceptance boundaries.
8. Do not merge without an explicit request.
