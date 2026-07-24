# Known Issues and Incomplete Boundaries

## MOTION-001: Keyframe editing is not implemented

- Status: Open
- Symptom: Motion Studio displays assets, semantic track names, and a timeline foundation but cannot write or move keyframes.
- Do not misinterpret: timeline ticks do not mean custom motion playback is complete.
- Next step: implement the semantic Rig, track, and keyframe domains first.

## MOTION-002: Custom motion runtime is not implemented

- Status: Open
- Symptom: the preview still plays existing built-in motions and does not evaluate custom tracks.
- Risk: static appearance controls cannot be reused as motion poses because that would overwrite the user's appearance.
- Next step: implement relative-pose evaluation and blending with base breathing and blinking.

## PROP-001: Prop geometry and material editors are not implemented

- Status: Open
- Symptom: Prop Studio manages assets, kinds, default mounts, and anchors but cannot edit real geometry or materials.
- Current constraint: disabled controls must remain disabled and must not appear complete.

## PROP-002: Prop event tracks are not implemented

- Status: Open
- Symptom: motions can record prop dependencies but cannot create, attach, detach, move, hide, or destroy props on the timeline.

## VISUAL-001: Real-browser pixel acceptance is pending

- Status: Manual acceptance required
- Automated coverage: numeric tests cover belly winding, surface offset, eye visibility, muzzle anchors, and front/hind paw normalization.
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
