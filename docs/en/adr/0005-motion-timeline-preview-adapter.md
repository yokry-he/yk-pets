# ADR 0005: Timeline Authoring and the Sole Production Preview Adapter

- Status: Accepted
- Date: 2026-07-25

## Context

The motion domain can evaluate a complete `EvaluatedCloudFoxPose` at any millisecond, but Motion Studio previously had no user-facing keyframe editing or production-preview consumption chain.

## Decision

1. Motion Studio owns an independent draft, undo/redo history, playhead, selection, and clipboard. Saving replaces the v2 asset in the shared library.
2. Add, delete, copy, paste, move, and interpolation changes call framework-neutral commands from `@yk-pets/pet-core`, with normalization continuing to resolve duplicate times and ranges.
3. Evaluate once per animation frame in the motion page and pass one immutable pose through `CloudFoxStudioCanvas -> ProceduralPet -> ExtensionAlignedCloudFox`.
4. Thin semantic adapters consume root, body, head, limbs, ears, eyes and mouth, tail, and antenna channels. Do not copy pet topology or create a second long-running WebGL scene.
5. Unauthored channels retain procedural breathing, blinking, gaze, and expressions; authored channels use semantic override or relative additive blending.
6. The thirty built-in motions retain their existing runtime path and are not converted into custom keyframe assets.

## Consequences

Users can author, save, and play custom motions without prop events. Prop events, smooth/Bézier interpolation, and curve editing remain later phases. Real-browser migration, GPU/WebGL, and pixel acceptance remain manual.
