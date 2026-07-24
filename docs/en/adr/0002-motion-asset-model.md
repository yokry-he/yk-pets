# ADR 0002: Motion Assets and the Semantic Rig

- Status: Accepted

## Context

Cloud Fox uses procedural parts, and its underlying meshes and geometry may continue to change. Binding keyframes to concrete meshes, fixed world coordinates, or appearance controls would prevent motions from working across head shapes, bodies, and proportions.

## Decision

- Motions use stable semantic Rig channels rather than mesh paths.
- Time is stored in milliseconds while the UI may display an FPS frame grid.
- Poses are local offsets relative to base appearance mounts.
- Motion tracks do not store concrete colors, head shapes, or body shapes.
- The thirty built-in motions remain read-only; future editing starts from an editable copy.
- Interpolation, looping, blending, and prop dependencies belong to the motion asset.

## Consequences

Motions can be reused across appearances, and renderer refactors do not immediately invalidate assets. The domain must be implemented and numerically tested before the timeline UI.

## Rejected alternatives

- Fixed frame arrays as the only time model;
- direct Three.js mesh transform paths;
- static appearance controls used as motion poses;
- direct mutation of built-in motions.
