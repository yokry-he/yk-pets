# Known Issues and Incomplete Boundaries

## MOTION-001: Timeline keyframe editing is not implemented

- Status: Open, with the domain foundation complete
- Complete: schema v2 tracks and keyframes, programmatic insertion, sorting, range clamping, duplicate-time handling, `step`/`linear` interpolation, and UI-free evaluation.
- Incomplete: users cannot write, move, copy, delete, or multi-select keyframes in Motion Studio.
- Do not misinterpret: read-only semantic Rig tracks and a domain insertion function do not mean timeline editing is available.
- Next step: establish an independent editing draft, undo semantics, playhead, and keyframe operations.

## MOTION-002: Custom motion runtime is not implemented

- Status: Open
- Symptom: Motion Studio preview still plays the existing idle motion and does not consume `EvaluatedCloudFoxPose`.
- Foundation complete: the UI-free evaluator can produce a complete semantic pose and authored-channel list at any millisecond.
- Risk: static appearance controls cannot be reused as motion poses because that would overwrite the user's appearance.
- Next step: implement a single-evaluation, multi-consumer pose adapter and define blending with breathing, blinking, and gaze.

## MOTION-003: Advanced interpolation and curve editing are not implemented

- Status: Open
- Current scope: only `step` and `linear` are supported.
- Incomplete: smooth and Bézier tangents, curve editor, onion skinning, and motion paths.
- Next step: complete the basic timeline and production preview before evaluating advanced curve tools.

## MOTION-004: Legacy motion-storage migration needs browser acceptance

- Status: Manual acceptance required
- Automated coverage: v1 data migrates to `yk-pets:studio:assets:v2` while preserving IDs, names, durations, loops, prop dependencies, and timestamps.
- Not manually verified: migration, refresh restoration, and rollback with real existing v1 browser data.
- Constraint: v1 storage is not automatically deleted.

## PROP-001: Prop geometry and material editors are not implemented

- Status: Open
- Symptom: Prop Studio manages assets, kinds, default mounts, and anchors but cannot edit real geometry or materials.
- Current constraint: disabled controls must remain disabled and must not appear complete.

## PROP-002: Prop event tracks are not implemented

- Status: Open
- Symptom: motions can record prop dependencies but cannot create, attach, detach, move, hide, or destroy props on the timeline.

## VISUAL-001: Real-browser pixel acceptance is pending

- Status: Manual acceptance required
- Automated coverage: numeric tests cover belly winding, surface offset, eye visibility, muzzle anchors, front/hind paw normalization, and the motion domain.
- Not covered: real Chrome Side Panel, GPU/WebGL depth ordering, varied host-page backgrounds, and final pixels.
- Reproduction: `.ai/visual-cases.json` and `/studio-visual-audit`.

## TEST-001: No browser screenshot baseline exists

- Status: Open
- Symptom: stable visual-audit routes exist, but the repository has no Playwright or pixel-baseline dependency.
- Prohibited claim: domain numeric tests must not be described as real screenshots having passed.

## HANDOFF-001: Feature commits must update the AI package

- Status: Enforced
- After the commit that adds `.ai/ENFORCEMENT_START`, any commit modifying feature source under `apps/` or `packages/` must update `.ai/project-state.json` and at least one handoff context file.
- Gate: `scripts/check-ai-handoff.mjs`.
