# ADR 0007: Versioned prop entities and parametric editing

- Status: Accepted
- Date: 2026-07-25

## Context

Motion events can reference stable prop IDs, but legacy prop assets only stored names, kind, and anchor names, so they could not describe real geometry, materials, or hierarchy.

## Decision

1. Prop assets use schema v2 with a parametric component tree, local transforms, materials, and four internal anchors: `origin`, `grip`, `display`, and `emitter`.
2. Supported components are sphere, box, cylinder, cone, torus, capsule, crystal, text plaque, and particles.
3. Assets are limited to 48 components, 240 particles, and 48 text characters; normalization clears duplicate IDs, missing parents, and hierarchy cycles.
4. Legacy metadata migrates locally into versioned entities while retaining stable asset IDs and motion dependencies.
5. Prop models render only inside the existing `CloudFoxStudioCanvas`; Prop Studio and motion-event preview share the same model components.
6. JSON import/export handles local parametric data only and performs no remote upload.

## Consequences

Prop Studio can edit real component trees, geometry, materials, internal anchors, duplication, and import/export. Real browser/WebGL, depth-order, and multi-device performance still require manual acceptance.
