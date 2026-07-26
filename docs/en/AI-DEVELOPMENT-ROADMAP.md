# AI Development Roadmap

Every phase must update the AI package in the same feature commit, run full CI, update the PR only after green, and never merge without an explicit request.

## Phase A: Semantic Rig and keyframe domain

- Status: Complete
- Stable channels, millisecond/FPS timing, schema v2, normalization, `step`/`linear`, loop timing, UI-free evaluation, and v1-to-v2 migration are complete.
- Real-browser migration acceptance remains manual.

## Phase B: Timeline editing and production preview

- Status: Complete; manual browser/WebGL acceptance required
- Independent drafts and undo/redo, playhead and controls, add/delete/copy/paste/move/multi-select, normalized conflict handling, once-per-frame evaluation, complete semantic adapters, procedural-channel preservation, save, and custom playback are complete.

## Phase C: Prop event tracks

- Status: Complete; manual WebGL acceptance required
- Stable prop/instance IDs, complete event lifecycle, mount/world space, style and particles, missing-dependency diagnostics, same-scene instance rendering, and hold/throw/catch/destroy tests are complete.

## Phase D: Prop Studio entity editing

- Status: Complete; manual browser/WebGL acceptance required
- Schema v2, legacy migration, nine parameterized component kinds, hierarchy and local transforms, materials, four internal anchors, same-scene preview, duplication, JSON import/export, and resource budgets are complete.

## Phase E: Advanced animation tools

- Status: Complete; manual browser/audio/WebGL acceptance required
- Smooth/Bézier interpolation, curve editing, lightweight onion skinning and paths, mirror/presets, layers/interruption, two-bone IK, local audio cues, and safety-reviewed local GLB validation and parsing are complete.

## Phase F: Browser acceptance and release hardening

- Status: Next
- Real Chrome/Side Panel/GPU/WebGL/audio/GLB acceptance, screenshot baselines, multi-resolution regression, and release documentation.

## Mandatory process

1. Verify AI package, PR, HEAD, and CI live.
2. Commit feature code and AI package together.
3. Update tests and architecture gates.
4. Run full CI.
5. Update PR only after green.
6. Preserve real-browser and WebGL manual acceptance boundaries.

### Phase F.1: Direct motion-authoring usability

- Status: Complete; manual browser acceptance required
- Completed the body-part tree, appearance-style numeric panel, current/selected/whole scopes, whole-pet and body scaling, symmetry, and preview drag pad.
- True model raycast picking and three-axis 3D gizmos remain after real-browser acceptance.
### Phase F.2: Motion Studio preview and Chinese-first UI polish

- Status: Complete; manual browser acceptance required.
- Complete: smaller default preview, continuous toolbar scaling, three-axis free rotation, drag controls, view reset, property-sidebar horizontal-overflow repair, and Chinese-first primary copy; canvas wheel scaling is currently paused.
- Preview transforms do not write into the motion asset; authored whole-pet rotation and scale remain semantic Rig keyframes.
