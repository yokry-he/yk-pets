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
- A compiler from five semantic motions to Quaternion animation, complex-model runtime IK, foot locking, Root Motion, complex dance/martial-arts/sport motions, and motion-driven effects.
- Runtime generation and editing for humanoid, quadruped, and mech Profiles; only `biped-pet/v1` is production-ready today.
- DCC or GLB export for the in-site parametric character. Its recipe and compiled data are only for this runtime and require neither GLB, Blender, nor hand rigging/skinning.

## 5. Motion consumption chain

`StudioMotionAssetV2 -> normalizeMotionAsset -> resolveMotionTime -> evaluateNormalizedMotionAsset -> EvaluatedCloudFoxPose -> CloudFoxStudioCanvas -> ProceduralPet -> ExtensionAlignedCloudFox -> semantic part adapters`

Evaluate once per frame. Store pose offsets relative to base appearance mounts and proportions; never mutate the appearance recipe.

## 6. Next phase

The next phase is `biped-pet-motion-and-browser-acceptance`:

1. Compile five semantic motions to Quaternion animation and let the complex biped runtime consume them.
2. Implement runtime IK, foot locking, Root Motion, complex motions, and deterministic motion effects.
3. Validate the shared recipe across all three workshops, persistence, simple fallback, keyboard operation, 1440×900/760×900 layout, and console state in a real browser.
4. Validate Chrome Side Panel, GPU/WebGL, depth ordering, audio user gestures, and final pixels across supported browsers.
5. Establish browser screenshot baselines and multi-resolution regression, then fix real-acceptance findings and update release documentation.
6. The PR still must not be merged without explicit user instruction.

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

## 16. Biped-pet Rig Profile contract batch

- `@yk-pets/pet-core` provides a framework-neutral `CharacterRigProfile` contract with stable diagnostics for unique bones, a single-root hierarchy, parents and cycles, semantic references, joint limits, contacts, sockets, and finite Vector3/Quaternion values.
- `biped-pet/v1` defines the first biped skeleton: root, pelvis, three spine bones, chest, neck, head, complete left/right arms and legs, plus optional ears, tail, and antenna chains.
- Foot contacts and left/right hand, left/right foot, head, back, and tail-root sockets are part of the domain contract.
- Renderers, procedural mesh generation, automatic skinning, Quaternion motion, runtime IK, foot locking, and Root Motion were not delivered by this contract alone and must not be represented as completed GPU/WebGL acceptance.

## 17. Biped-pet parametric model-recipe batch

- `CharacterModelRecipeV1` stably declares `biped-pet/v1`, `biped-pet-generator/v1`, proportions, ears/tail/antennae, materials, and update time. It is an in-site generator input, not a GLB or other exchange format.
- `normalizeBipedPetModelRecipe` repairs unknown enums, `NaN`, invalid colors, and out-of-range values without throwing. The same input and injected time produce deterministic output.
- `applyBipedPetBodyStyle` replaces only a body-style preset and retains user-configured appendages, material, identity, and time.

## 18. Automatic skeleton, mesh, and skin compilation batch

- `compileBipedPetCharacter` deterministically compiles the in-site recipe into a `biped-pet/v1` skeleton, optional appendage chains, indexed procedural mesh, and up to four generated weights per vertex. It is framework-neutral and creates no Three.js object.
- Tubes use fixed radial/axial topology and smooth weight transitions. Head, hand, and foot end regions are rigidly bound to their semantic bones for stable future runtime consumption.
- The result clones joint limits, contacts, and sockets, validates hierarchy, finite values, and non-negative weights, and returns `blocked` diagnostics for invalid internal state. Ordinary damaged recipes are repaired before compilation.

## 19. Recipe and compilation persistence batch

- The `studio-model-variants` complex container persists `CharacterModelRecipeV1` and a lightweight compilation summary. First entry to Complex mode creates a default biped-pet recipe without overwriting the simple model or an edited recipe.
- Patch updates accept only editable fields, deep-merge proportions, appendages, and material, clear stale compilation data, and return to a draft state.
- Store commit recompiles the current recipe. It marks the variant ready only when submitted hash/status and current compilation all match; stale data retains a diagnostic and draft state.

## 20. Three runtime and adapter batch

- `createComplexBipedPetObject` accepts only ready framework-neutral compilation results and creates BufferGeometry, SkinnedMesh, Bone/Skeleton hierarchy, and sockets resolved by `boneId`. Invalid hierarchy, index, or socket input is rejected with safe domain errors.
- Geometry contains explicit position, skinIndex, skinWeight, and index buffers, normals, and bounds. The base material color comes from the recipe; secondary color is only a weak emissive accent.
- `dispose()` is idempotent and releases geometry, material, and skeleton, including partially created resources after a failure.
- `ComplexBipedPetRenderer.vue` is a Canvas-free Vue/Tres adapter. It normalizes once for compilation and material creation, deduplicates by compilation key, owns disposal, and turns runtime exceptions into diagnostics.

## 21. Unified complex-workshop preview batch

- `CloudFoxStudioCanvas` still creates one existing `TresCanvas`. In Complex mode with a recipe, it replaces the simple renderer with `ComplexBipedPetRenderer`; Simple mode or a missing recipe continues to use `ProceduralPet` without stacking two pets.
- Canvas forwards a real `compilation` event as `complex-compiled`. Appearance commits only a hash that matches the current recipe, while the Store repeats the final persistence check.
- A blocked compilation or Three runtime failure displays “Generation failed; falling back to the simple model” and actually uses the simple renderer for that session without deleting the selected complex mode or recipe.
- Appearance, Motion, and Prop Studio read the same persisted recipe by `petId`; only Appearance edits the recipe and commits compilation. The library reports profile, generator, compilation status, diagnostics, and completion honestly.

## 22. Beginner complex-model editor batch

- Appearance Studio shows `StudioComplexModelEditor` only in Complex mode with a current recipe. Its normal surface exposes Soft, Athletic, Round, and Slender presets, nine bounded proportions, and ear/tail/antenna toggles.
- The parent owns edits: presets use `applyBipedPetBodyStyle`, local patches use `studio-model-variants.updateComplexRecipe`, and appendage toggles write only `enabled`, retaining their length and segments. Every recipe change clears stale compilation and triggers the existing runtime recompilation path.
- Range inputs update local draft state on `input` and commit once on `change`; numeric inputs reject empty/invalid values. External recipe changes do not overwrite an active drag. The container has no undo history and must not claim drag merging.
- Advanced information is read-only. At ≤760px the editor is single-column; presets expose `aria-pressed`, and controls retain labels and keyboard focus.

## 23. Biped-pet Phase 1 delivery status

- Phase 1 is complete only for `biped-pet/v1`, `CharacterModelRecipeV1`, procedural skeleton/mesh generation, up-to-four automatic weights, the Three complex runtime, recipe persistence, unified previews in all three workshops, and beginner body-style/proportion/appendage editing.
- On a runtime failure, stale hash, or damaged local data, the current session displays the simple-model fallback. The simple Cloud Fox remains on the canonical production render path; fallback does not delete the selected complex mode or recipe.
- This is not GLB import/export, a Blender workflow, or manual bone/skin authoring. The in-site format promises consumption only by this runtime.
- Two blockers found in a real browser received minimal fixes with static regressions: complex `TresGroup.rotation` now receives the canonical/free-rotation composition as an `Euler`, not a `Vector3`; the four Studio-layout stores hydrate only after `onMounted`, the workspace watch writes only after `session.hydrated`, and the current routed workspace is persisted only after restoration. This prevents default `simple` from overwriting a saved complex mode or the parent from mutating child hydration input first.
- The primary agent completed the real-browser recheck for this batch: a new tab has no error or hydration mismatch; Complex mode survives refresh; motion templates and appendages persist; simple fallback works; `motion`, `props`, and `library` share one ready complex recipe; the library shows `biped-pet/v1`, `biped-pet-generator/v1`, and zero diagnostics; and at 760×900, `clientWidth === scrollWidth === 760` with all four presets, nine proportions, and three appendage controls present. This completes the batch's functional Studio browser acceptance, but it does not replace the still-incomplete final cross-browser GPU/WebGL acceptance.
- `.ai/visual-cases.json` lists 1440×900, 760×900, four presets, persistence, three-workshop state, simple fallback, keyboard operation, no overflow, console, and GPU checks as manual acceptance. Functional Studio browser acceptance for this batch is complete; `cross-browser-gpu-manual-acceptance` and the cross-browser GPU/WebGL and final-pixel items remain incomplete until that separate graphics acceptance is performed.

## 24. Complex-model semantic prop-mount repair

- `CloudFoxStudioCanvas` now forwards `propInstances`, `propAssets`, and `preservePropMaterials` to the complex renderer, so Complex mode no longer silently drops Motion or Prop Studio prop previews.
- The complex runtime creates a bone-following `Group` for every compiled socket. Each complex prop instance first creates its complete `StudioPropModel` subtree under a normal Tres parent, then reparents the whole Group to the semantic node on the next Vue tick after `onMounted`. It does not use Tres custom attach, which drops host children across component subtrees. Parametric/local-model and material-policy behavior still reuse the same implementation as Simple mode.
- Legacy paw mounts map strictly to `hand.left`, `hand.right`, `foot.left`, and `foot.right`; `head-top` maps to the `head` socket. Because the Phase 1 Profile has no dedicated muzzle or tail-tip socket, `muzzle` conservatively follows the `head` bone and `tail-tip` follows the last real tail bone, falling back to the `tail.base` socket only when no tail bone exists. No simple-model geometry estimate is used.
- `pet-root` uses the real `root` bone. `space: world` and the legacy `world` mount remain in character-root space rather than the global Tres scene, so the overall preview transform still applies consistently.
- Runtime disposal detaches socket groups from old bones, while instance teardown removes its Group only when it still belongs to the resolved target. Automated coverage verifies that a Group containing a real Mesh keeps that child across reparenting, plus all legacy mappings, idempotent disposal, and Canvas forwarding.
- The primary agent still needs to rerun the browser cases in `.ai/visual-cases.json` for prop visibility, bone following, world space, material policy, and console errors. This must not be described as completed cross-browser GPU/WebGL acceptance. The phase still uses the default pose and does not add complex motion solving.

## 25. Lazy review of historical complex-model data

- The `studio-model-variants` collection hydrator now uses an explicit `hydration` mode. It normalizes recipes, authoritative identity keys, and simple variants without fully compiling every historical pet that carries a summary.
- Persisted `ready`/`blocked` values are only lightweight summaries and are no longer trusted during hydration. The summary is cleared, the complex variant safely returns to `draft` with 5% completion, and its recipe plus collection-key-authoritative `petId` remain intact.
- `ensurePet`, recipe updates, and compilation commits retain the verified-memory behavior, so an already reviewed ready/blocked state does not regress during ordinary in-memory Store operations. The current pet is recompiled only after it enters the existing complex renderer, then `commitComplexCompilation` performs the final hash/status review before writing ready.
- The 100-entry regression uses structural and state assertions instead of machine-specific absolute timing thresholds. Damaged-input repair, the simple model, and authoritative collection keys remain covered.
- `.ai/visual-cases.json` now records pending browser rechecks for 10/50/100 historical entries. This batch has not completed those real-browser checks and does not change semantic prop mounts, complex motion, IK, foot locking, Root Motion, VFX, or the incomplete cross-browser GPU/WebGL boundary.
