# ADR 0004: Motion Keyframe Domain and Deterministic Evaluation

- Status: Accepted

## Context

Motion Studio already had stable asset IDs, millisecond durations, and loop metadata, but legacy assets stored metadata only, while the thirty production motions were still evaluated independently inside several renderer components. Binding timeline data directly to Three.js node paths, appearance controls, or fixed frame arrays would prevent custom motions from surviving head-shape, body-proportion, and renderer refactors.

## Decision

- Establish the framework-neutral `cloud-fox-semantic-rig/v1` in `@yk-pets/pet-core`.
- Cover the root, body, head, front and hind paws, ears, eyes, mouth, tail, and antennae with semantic channels.
- Store translation as normalized local offsets relative to base mounts and appearance scale, rotation in radians, and scale as relative ratio deltas.
- Persist time only as integer milliseconds; `displayFps` controls UI display and snapping only.
- Upgrade motion assets to schema v2 with `rigId`, `displayFps`, tracks, and keyframes.
- Merge duplicate tracks for the same channel during normalization, and let the last input keyframe win when several keyframes share the same millisecond.
- Support only `step` and `linear` interpolation in the first domain release.
- Produce one complete semantic pose plus the authored-channel list from the UI-free evaluator.
- Migrate `appearanceId` to `authoringAppearanceId` for authoring traceability only; it never participates in evaluation.
- Migrate v1 local assets to `yk-pets:studio:assets:v2` while retaining the old storage key for rollback.
- Do not wire the production renderer or implement timeline keyframe editing, auto-key, prop events, or a curve editor in this ADR.

## Consequences

The motion domain can now create assets, insert keyframes, normalize data, and evaluate any time without Vue, TresJS, Three.js, or browser UI. A later renderer adapter can consume one semantic pose without understanding persistence or timeline-cleanup rules.

## Compatibility and Migration

- Legacy motion IDs, names, durations, loop modes, prop dependencies, and timestamps are preserved.
- Legacy `appearanceId` becomes authoring context only and does not create a runtime binding.
- Empty-track motions evaluate to a complete neutral pose, so the existing idle preview does not change visually.
- The thirty built-in motions remain read-only and their runtime stays unchanged.

## Rejected Alternatives

- Binding keyframes directly to Three.js meshes or Vue refs.
- Replacing millisecond storage with FPS frame numbers.
- Using static appearance controls as motion poses.
- Keeping several keyframes at the same time and relying on object iteration order.
- Wiring a complex timeline or a second renderer before the domain contract is stable.
