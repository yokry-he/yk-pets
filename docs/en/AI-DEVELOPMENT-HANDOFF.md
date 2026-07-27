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
- The preview canvas supports pitch/yaw drag rotation, toolbar scaling, numeric three-axis rotation, and one-click reset; canvas wheel scaling is currently paused.
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

## 12. Unified Studio preview orientation batch

- Added `useStudioPreviewOrientation` as the shared free-rotation offset and pointer-drag lifecycle controller for Appearance, Motion, and Prop Studio.
- Front, Left, Back, and Right are now absolute canonical views: selecting one clears free-rotation offsets before updating the shared Studio view.
- Clicking an already-active view also resets the drag offset, preventing canonical rotation from being combined with stale offsets.
- Appearance part hotspots and the Prop Studio mount badge keep their foreground interaction layers; the drag surface is limited to each 3D preview.
- `scripts/check-studio-preview-orientation.mjs` covers shared-controller semantics, all three integrations, canonical reset, and interaction-layer exclusions. Drag feel still requires the documented real GPU/WebGL acceptance pass.

## 13. Shared preview toolbar batch

- Added `StudioPreviewToolbar.vue`, removing separately maintained view and preview-transform forms from Appearance, Motion, and Prop Studio.
- The toolbar uses two levels: canonical views, background, extension actions, and reset on the first; scale, X/Y/Z free rotation, and optional preview time on the second.
- Motion Studio moves the toolbar out of the canvas overlay so it no longer covers the pet; its direct manipulation pad remains inside the canvas.
- Appearance Studio preserves Part Hotspots and Compare Classic through the actions slot, while Prop Studio now receives the shared Chinese canonical-view labels.
- `useStudioPreviewOrientation` owns 40%–120% scale bounds and workspace-specific default-scale reset; its wheel handler is retained, but none of the three workspaces binds a wheel event.
- `scripts/check-studio-preview-toolbar.mjs` covers grouping, three-workspace reuse, scale wiring, optional time, and extension-action contracts.

## 14. Expression, safe deformation, and built-in asset batch

- Appearance options add six emotional eye styles and three nose styles; the canonical eye metric table now covers twelve styles on the production head surface.
- The semantic Rig adds fifteen motion-safe channels for head scale, eye scale/spacing/pupil/tilt, nose scale/offset/sniff/glow, mouth curve, tail length/fluff, and antenna glow.
- New channels use neutral zero defaults, so legacy motions need no migration. Motion Studio writes them through the existing part tree and current-frame commands instead of storing appearance JSON.
- Six read-only procedural props and six read-only motion templates are registered. Copying creates independent local IDs and never persists the original templates.
- Nebula Staff Spin and Starlight Sway include built-in prop events, and Motion preview merges built-in and user prop registries.
- `check-studio-expression-motion-assets.mjs`, `test-studio-built-in-assets.ts`, and pet-core domain tests cover registration, ranges, dependencies, and wiring.

## 15. Dual-model Studio foundation batch

- One pet now owns independently persisted simple and complex model variants; the procedural simple model remains ready by default and keeps the only production render path.
- Studio has a global model mode. Selecting Complex for the first time creates a non-destructive draft automatically without another confirmation step or overwriting the simple model.
- Appearance, Motion, and Prop Studio share the model mode, while the asset library reports the complex variant as missing, draft, ready, or blocked.
- `CloudFoxStudioCanvas` now exposes the complex-preview adapter boundary, but explicitly uses the simple-model compatibility preview until the skeletal renderer exists.
- The next phase is now `in-site-parametric-biped-rig`: pet GLB import is removed; an in-site recipe compiler will generate the `biped-pet/v1` skeleton, mesh, skin weights, sockets, and semantic mapping automatically.
- Versioned Rig Profiles preserve future humanoid, quadruped, and mech support, while the first production profile remains focused on biped pets.
- `browser-acceptance-and-release-hardening` remains mandatory after the complex runtime exists; this batch's static checks are not real GPU/WebGL acceptance.
