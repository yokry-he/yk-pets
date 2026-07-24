# AI Development Roadmap

This roadmap restores development order in a new session and does not replace live GitHub state. Every phase must update the AI handoff package in the same feature commit and pass the full CI workflow.

## Phase A: Semantic Rig and keyframe domain

Goal: establish motion data that is independent from concrete Three.js meshes.

- Define semantic channels for the pet root, body, head, front and hind paws, ears, eyes, mouth, tail, and antennae.
- Store time in milliseconds while allowing the UI to display an FPS grid.
- Define keyframes, tracks, interpolation, looping, and normalization.
- Store pose offsets relative to appearance defaults and mount points.
- Add domain tests, legacy migration, and range validation.

Completion criterion: without a UI, code can create a motion asset, insert keyframes, and evaluate a complete pose at any time.

## Phase B: Timeline editing and production preview

- Playhead and playback controls;
- auto-key and manual pose capture;
- add, delete, copy, move, and multi-select keyframes;
- linear, smooth, hold, and Bézier interpolation;
- duration scaling and loop-seam checks;
- connect evaluated poses to the sole production Cloud Fox preview.

Completion criterion: a user can create, save, refresh, restore, and play a complete custom motion without prop events.

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

- Curve editor;
- onion skinning;
- motion paths;
- left/right mirroring and pose presets;
- motion layers and interruption policy;
- optional IK assistance;
- audio tracks;
- local GLB prop import only after security and performance review.

## Mandatory process for every phase

1. Verify the AI package, code, PR, and latest CI before editing.
2. State scope and acceptance criteria.
3. Commit feature code and AI package updates together.
4. Update tests and architecture gates.
5. Run full CI.
6. Update the PR only after green.
7. Preserve real-browser and WebGL manual acceptance boundaries.
8. Do not merge without an explicit request.
