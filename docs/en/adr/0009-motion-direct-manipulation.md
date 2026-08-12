# ADR 0009: Direct body-part motion manipulation and whole-clip correction

- Status: Accepted
- Date: 2026-07-25

## Context

A channel dropdown remains useful for precise editing but is not an approachable primary authoring surface. Authors need an Appearance-Studio-like flow: select the whole pet or a semantic body part, then translate, rotate, scale, or adjust semantic values while choosing whether the edit affects the current frame, selected keyframes, or the whole clip.

## Decision

1. Add one framework-neutral body-part and control registry to `@yk-pets/pet-core`; every control continues to reference `cloud-fox-semantic-rig/v1`, never a Three.js node path.
2. Support `current-frame`, `selected-keyframes`, and `entire-motion` authoring scopes.
3. Store whole-clip edits in a separate priority-100 additive `clip-adjustment` layer without rewriting authored keyframes.
4. Root and body expose translation, rotation, uniform scale, and advanced per-axis scale. Other parts expose only controls safely represented by the existing semantic Rig.
5. Provide symmetry for paired paws, ears, and antennae through stable channel mirroring rules.
6. Add a lightweight drag pad over the preview. True raycast model picking and three-axis 3D gizmos remain a separate post-browser-acceptance batch.

## Consequences

- Motions remain semantic offsets reusable across appearances.
- One drag gesture creates one undo checkpoint.
- No renderer, Canvas, upload, polling, or permission is added.
