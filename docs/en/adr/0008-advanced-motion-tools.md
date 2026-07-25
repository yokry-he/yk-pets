# ADR 0008: Advanced motion tools and safe local resources

- Status: Accepted
- Date: 2026-07-25

## Decision

1. Keyframe interpolation supports `step`, `linear`, `smooth`, and numeric-tangent `bezier`.
2. Motion layers apply prioritized `override` or `additive` composition with enabled state, weight, and interruption policy.
3. Curve editing, onion skinning, and motion paths render lightweight semantic guides only; they do not duplicate Cloud Fox topology or create another TresCanvas.
4. Mirroring, pose presets, and two-bone IK generate semantic keyframes without mutating appearance recipes.
5. Audio tracks support local tones and size-bounded local audio data URLs without remote upload.
6. Local GLB is limited to 2 MB, GLB v2, matching declared length, a valid JSON chunk, and no external URI; accepted files use `GLTFLoader.parse` in the existing scene.

## Consequences

Phase E provides a complete local advanced-authoring chain. Real browser audio permission, GPU/WebGL, complex GLB, and final pixels still require manual acceptance.
