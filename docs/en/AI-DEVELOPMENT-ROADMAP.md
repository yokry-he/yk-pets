# AI Development Roadmap

Every phase must update the AI package in the same feature commit, run full CI, update the PR only after green, and never merge without an explicit request.

## Phase A: Semantic Rig and keyframe domain

- Status: Complete
- Stable channels, millisecond/FPS timing, schema v2, normalization, `step`/`linear`, loop timing, UI-free evaluation, and v1-to-v2 migration are complete.
- Real-browser migration acceptance remains manual.

## Phase B: Timeline editing and production preview

- Status: Complete; manual browser/WebGL acceptance required
- Independent drafts and undo/redo, playhead and controls, add/delete/copy/paste/move/multi-select, normalized conflict handling, once-per-frame evaluation, complete semantic adapters, procedural-channel preservation, save, and custom playback without prop events are complete.
- This phase uses `step` and `linear`; advanced curves remain Phase E.

## Phase C: Prop event tracks

- Status: Complete; manual WebGL acceptance required
- Stable prop/instance IDs, full event lifecycle, mount/world space, style and particles, missing-dependency diagnostics, same-scene instance rendering, and hold/throw/catch/destroy tests are complete.

## Phase D: Prop Studio entity editing

- Status: Next
- Parameterized primitives, hierarchy and local transforms; material, color, opacity, metalness, roughness, and glow; `origin`/`grip`/`display`/`emitter`; preview, duplication, JSON import/export, and budgets.

## Phase E: Advanced animation tools

- Status: Planned
- Smooth/Bézier, curve editor, onion skinning, motion paths, left/right mirror and pose presets, motion layers and interruption, optional IK, audio tracks, and security/performance-reviewed local GLB import.

## Mandatory process

1. Verify AI package, PR, HEAD, and CI live.
2. Commit feature code and AI package together.
3. Update tests and architecture gates.
4. Run full CI.
5. Update PR only after green.
6. Preserve real-browser and WebGL manual acceptance boundaries.
