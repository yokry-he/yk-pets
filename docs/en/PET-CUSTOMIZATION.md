# Pet Customization System

## Structural principles

Pet Studio is organized into recipe, rendering, and workspace layers.

- `parts.bodyShape` and `parts.headShape` are stored independently.
- Changing the body never changes the head.
- Legacy recipes without a head shape migrate to `classic-round`.
- Default, Studio, and imported JSON use the same production Cloud Fox composition.

## Bodies and heads

Body choices: sphere, ellipsoid, capsule, pear, bean, and rounded cube.

Head choices: classic round, wide round, oval, capsule, bean, and rounded square.

`cloud-fox-shape-profile.ts` exposes separate body and head profiles, so these choices can be combined freely.

## Sole model surfaces

- `ExtensionCloudFoxBodyShape.vue` is the sole torso surface.
- `ExtensionCloudFoxBody.vue` composes the torso, limbs, core, and symbols.
- `ExtensionCloudFoxHeadShape.vue` is the sole head shell.
- `ExtensionCloudFoxHead.vue` owns one animated Head Rig and one FaceRoot.
- `cloud-fox-limb-motion.ts` preserves complete front and hind limb poses.

## Eyes and face

Spark eyes use crossed light slivers, crystal diamond eyes use octahedral crystals, and sleepy eyes use a thin curve. Round and oval eyes continue to support pointer, ball, diving-catch, and fireworks gaze.

The classic Cloud Fox mouth preserves the original rounded mouth and tongue. Cat, line, open, and pout choices use thin curves or shallow oral geometry. Nose and mouth parts live in the sole head-local coordinate space.

## Belly patch

The belly no longer creates a body. Ten silhouettes render on a subdivided curved decal fitted by the current body profile, with a small depth offset to avoid a hollow center caused by body occlusion.

## Studio workspace

- Uses `100dvh` and explicit grid tracks.
- Inspector controls scroll independently; the schemes section is collapsed by default.
- Part hotspots are off by default and appear only after selecting **Locate parts**.
- `/` focuses search; `Escape` closes search, hotspots, and classic comparison.
- The page-pet overlay is hidden while authoring in Studio.
- Desktop, narrow, and mobile layouts use explicit breakpoints.

## Local boundaries

Drafts, formal recipes, and named schemes remain on the device. This phase adds no browser permission, upload, or background polling. Network Lab, Pet Memory, Page Audit, Local Agent, and existing 3D performance controls remain unchanged.
