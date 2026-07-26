# AI Development Handoff

## 1. Collaboration boundaries

- Repository: `yokry-he/yk-pets`
- Sole development branch: `agent/cloud-fox-studio-v0610`
- PR #7 targets `agent/yk-pets-rebrand-v0610`.
- Do not merge without an explicit user request. Run full CI for every independent batch and update the PR only after green.
- New sessions must verify HEAD, PR state, and CI from GitHub; this file intentionally stores no live SHA.

## 2. Canonical architecture

- Sole production composition: `apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue`
- Shared preview: `apps/playground/app/components/studio/CloudFoxStudioCanvas.vue`
- Framework-neutral motion domain: `packages/pet-core/src/motion/`
- Studio routes: `/studio/appearance`, `/studio/motion`, `/studio/props`, `/studio/library`

Do not copy a second pet topology or create another continuously running WebGL scene.

## 3. Completed capabilities

### Appearance and unified Studio

The complete Appearance Studio, shared navigation, local StudioSession, stable motion/prop IDs, shared library, and sole production renderer are complete.

### Semantic Rig and keyframe domain

- `cloud-fox-semantic-rig/v1`;
- millisecond timing with FPS display metadata;
- schema v2 motions, tracks, keyframes, and v1-to-v2 migration;
- clamping, track merging, and last-input-wins duplicate times;
- `step`/`linear` and `once`/`loop`/`ping-pong`;
- deterministic UI-free pose evaluation.

### Timeline authoring and production preview

- Independent motion drafts, undo/redo, dirty state, and save;
- playhead, play/pause/stop, and loop modes;
- writing, deleting, copying, pasting, moving, and multi-selecting keyframes;
- FPS snapping and exact millisecond entry;
- semantic pose editing for root, body, head, front/hind paws, ears, eyes, mouth, tail, and antennae;
- one `EvaluatedCloudFoxPose` evaluation per frame;
- one immutable pose passed through the sole production preview and consumed by thin semantic adapters;
- breathing, blinking, gaze, and existing expressions retained on unauthored channels;
- the thirty built-in motion runtime paths remain unchanged.

### Prop-event tracks

- Stable prop and instance IDs.
- Create, show, attach, detach, move, hide, style, and destroy events.
- Mount/world-space instance evaluation.
- Color, opacity, glow, and particle rate.
- Missing-dependency diagnostics and deletion-cleanup foundations.
- Instances rendered in the sole production TresCanvas.
- Deterministic hold, throw, catch, and effect authoring.

### Prop Studio entity editing

- Schema v2 parametric prop entities and legacy metadata migration.
- Sphere, box, cylinder, cone, torus, capsule, crystal, text plaque, and particle components.
- Component hierarchy, local transforms, duplication, and recursive deletion.
- Color, opacity, metalness, roughness, glow color, and glow intensity.
- Internal `origin`, `grip`, `display`, and `emitter` anchors.
- Budgets of 48 components, 240 particles, and bounded text.
- Local JSON import/export and shared production-scene model preview.

### Advanced animation tools

- `smooth` and numeric-tangent `bezier` interpolation with a curve editor.
- Lightweight semantic onion skins and root motion paths.
- Left/right mirroring and pose presets.
- Weighted, enabled `override`/`additive` layers and interruption policy.
- Two-bone front-paw IK assistance.
- Local tone and size-bounded local audio tracks.
- Safe local GLB validation and same-scene parsing limited to 2 MB, GLB v2, and no external URI.

## 4. Explicitly incomplete

- Advanced interpolation for prop events;
- browser screenshot baselines;
- real Chrome Side Panel, GPU, and WebGL manual acceptance.

## 5. Motion consumption chain

`StudioMotionAssetV2 -> normalizeMotionAsset -> resolveMotionTime -> evaluateNormalizedMotionAsset -> EvaluatedCloudFoxPose -> CloudFoxStudioCanvas -> ProceduralPet -> ExtensionAlignedCloudFox -> semantic part adapters`

Evaluate once per frame. Store pose offsets relative to base appearance mounts and proportions; never mutate the appearance recipe.

## 6. Next phase

The next phase is `browser-acceptance-and-release-hardening`:

1. Validate timeline, prop events, prop entities, and advanced tools in a real browser.
2. Validate Chrome Side Panel, GPU/WebGL, depth ordering, audio user gestures, and complex GLB files.
3. Establish browser screenshot baselines and multi-resolution regression.
4. Fix issues found by real acceptance and update release documentation.
5. The PR still must not be merged without explicit user instruction.

## 7. Manual acceptance still required

- Real-browser v1-to-v2 migration, refresh restoration, and rollback.
- Timeline dragging, keyboard operations, and custom-motion save/restore.
- Real Chrome Side Panel, GPU/WebGL, depth ordering, and final pixels.

## 8. Mandatory policy

Every feature commit modifying `apps/` or `packages/` must update `.ai/project-state.json` and at least one handoff context in the same commit. `scripts/check-ai-handoff.mjs` enforces this per commit.

Trust order: actual code and runtime results > latest full CI > machine state > ADR/handoff > PR > old chat history.

## 9. Direct motion manipulation batch

- Added a semantic body-part tree and one control registry.
- Added current-frame, selected-keyframe, and whole-clip authoring scopes.
- Added whole-pet and body translation, rotation, uniform scale, and advanced per-axis scale.
- Added safe semantic controls for the head, paws, ears, tail, antennae, eyes, and mouth.
- Added symmetry, reset, numeric stepping, W/E/R/S/Q/K shortcuts, and a preview drag pad.
- Whole-clip edits use a separate additive `clip-adjustment` layer and do not rewrite authored keyframes.
- True model raycast picking and three-axis 3D gizmos remain a later real-browser batch.
## 10. Motion Studio preview and Chinese-first usability batch

- Motion preview now defaults to a 72% view scale and supports continuous adjustment from 40% to 120%.
- The preview canvas supports pitch/yaw drag rotation, wheel scaling, numeric three-axis rotation, and one-click reset.
- Preview transforms remain independent from the motion asset and never create keyframes implicitly; authored whole-pet scale and rotation still use semantic Rig controls.
- The property sidebar, motion layers, curve editor, and prop-event forms use shrinkable grids and prevent horizontal overflow.
- Primary Motion Studio headings, views, interpolation, layer modes, and prop-event labels are Chinese-first.
- Final sizing, drag feel, and OS scrollbar behavior still require real-browser acceptance.

## 11. Documentation system

- Chinese topic documents and ADRs now use Chinese filenames, while English documents keep English filenames.
- `技术栈.md` / `TECH-STACK.md` documents runtime, frontend, 3D, domain-package, Local Agent, OpenAI, and validation-tool boundaries.
- Architecture, project status, development, and maintenance guides now reflect the current code and machine state.
- `scripts/check-documentation.mjs` uses explicit bilingual filename pairs and validates Chinese filenames, required technology-stack sections, and repository-local Markdown links.
- New or renamed documentation must update bilingual pairs, the documentation index, focused scripts, and `.ai` handoff paths together.
