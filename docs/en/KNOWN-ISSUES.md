# Known Issues and Incomplete Boundaries

## MOTION-001: Timeline editing is implemented; browser interaction acceptance remains

- Status: Implemented; manual acceptance required
- Complete: independent drafts, undo/redo, playhead, write/delete/copy/paste/move/multi-select, FPS snapping, save, and interruption-aware motion switching.
- Not manually verified: real-browser dragging, keyboard shortcuts, narrow layouts, and refresh restoration.

## MOTION-002: Production custom-motion preview is wired

- Status: Implemented; manual WebGL acceptance required
- Complete: evaluate once per frame, consume the pose through the sole production Cloud Fox renderer, retain procedural behavior on unauthored channels, and blend out custom pose values when requested.
- Not manually verified: real GPU/WebGL depth ordering, varied appearances, and final pixels.

## MOTION-003: Advanced animation tools are implemented; real browser/audio/WebGL acceptance remains

- Status: Implemented; manual acceptance required
- Complete: smooth/Bézier, curve editor, lightweight onion/path guides, mirror/presets, layers/interruption, IK, local audio, and safe local-GLB policy.
- Not manually verified: browser audio user gestures, complex curve editing, real-GPU guides, and complex GLB models.

## MOTION-004: Legacy motion-storage migration needs browser acceptance

- Status: Manual acceptance required
- Automated: v1 migrates to `yk-pets:studio:assets:v2` while preserving IDs, names, durations, loops, prop dependencies, and timestamps.
- Constraint: v1 is not automatically deleted; real-browser migration, refresh, and rollback remain unverified.

## PROP-001: Prop entity editing is implemented; browser/WebGL acceptance remains

- Status: Implemented; manual acceptance required
- Complete: schema v2, nine parameterized component kinds, hierarchy/local transforms, materials, four internal anchors, duplication, JSON import/export, and resource budgets.
- Not manually verified: real-GPU depth ordering, complex hierarchy, device performance, text-plaque pixels, and complex local GLB models.

## PROP-002: Prop event tracks are implemented; real WebGL acceptance remains

- Status: Implemented; manual acceptance required
- Complete: full event lifecycle, mount/world space, style/particles, missing-dependency diagnostics, and same-scene instance preview.
- Not manually verified: real GPU depth ordering, complex trajectories, and high particle-count performance.

## VISUAL-001: Real-browser pixel acceptance is pending

- Status: Manual acceptance required
- Automated: numeric geometry, semantic-pose flow, sole-renderer gates, and lightweight guide contracts.
- Not covered: real Chrome Side Panel, GPU/WebGL, host-page backgrounds, audio permissions/user gestures, and final pixels.

## TEST-001: No browser screenshot baseline exists

- Status: Open
- Static gates and numeric tests must not be described as real screenshots having passed.

## HANDOFF-001: Feature commits must update the AI package

- Status: Enforced
- Feature commits modifying `apps/` or `packages/` must update `.ai/project-state.json` and at least one handoff context.
- Gate: `scripts/check-ai-handoff.mjs`.
