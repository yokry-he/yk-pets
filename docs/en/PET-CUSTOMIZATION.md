# Pet Customization System

## One recipe and one production model

YK-PETS uses one `customization` recipe layer and one production `ExtensionAlignedCloudFox.vue` composition. Legacy Studio data, the extension classic appearance, and imported JSON are compatibility-normalized before entering the same model, motion runtime, and Shape Profile. Default, imported, and Studio pets do not create separate renderers.

## Stable Studio layout

Search, classic comparison, part hotspots, recent history, and the local scheme library now live directly in the Vue page instead of being injected or moved after mount.

- The top bar uses explicit title, search, and action grid tracks.
- Narrow layouts switch at defined breakpoints.
- The inspector gives the advanced panel and parameter list independent layout and scrolling.
- The main Studio page hides the fixed cross-page shortcut and webpage-pet overlay to prevent obstruction.
- `/` focuses search; `Escape` clears search and exits the read-only classic comparison.

## One face hierarchy

The head now has one animated Head Rig and one FaceRoot.

- The production head no longer renders legacy nose/mouth parts, cover ellipsoids, and replacement parts together.
- Nose, mouth, tongue, and cheeks use head-local coordinates.
- Head motion is calculated once and the face follows the sole Head Rig.
- The default `smile` restores the original production Cloud Fox rounded mouth and tongue.
- Cat, line, open, and pout styles use thin curves or a thin mouth cavity instead of side-facing torus overlays.

Nose choices remain soft round, fox triangle, sensor, button, and heart. Muzzle, nose, mouth, tongue, and cheek colors are independently configurable.

## Eyes

Spark and crystal-diamond eyes no longer share one dodecahedron.

- Spark eyes use crossed narrow luminous blades for a clear star silhouette.
- Crystal-diamond eyes use a vertical octahedral crystal with faceted material.
- Round and oval eyes keep ball, pointer, and fireworks gaze behavior.
- Spark, diamond, and visor eyes no longer receive a circular gaze overlay.

## Six body shapes and matching heads

The shared `cloud-fox-shape-profile.ts` drives body silhouette, head form, eye/ear spacing, face depth, belly placement, and camera bounds.

- Sphere: uniform round body and round head.
- Ellipsoid: extension-classic body and head.
- Capsule: cylindrical center with rounded ends and a taller head.
- Pear: bottom-heavy body with a compact round head.
- Bean: tilted two-lobe silhouette with a slightly tilted oval head.
- Rounded cube: `RoundedBoxGeometry` body and matching rounded-square head.

The new outer silhouettes enclose the production body baseline, preserving the existing paws, hind limbs, tail, symbols, and all thirty motions. Shape Profiles also provide head offsets, face-forward depth, belly front depth, and bounds multipliers.

## Belly patch

The default remains an explicit **ellipse**. Available shapes are ellipse, egg, shield, teardrop, inverted teardrop, asymmetric bean, rounded rectangle, heart, cloud, and chest fur.

The belly supports visibility, color, width, height, horizontal/vertical position, rotation, and softness. It now uses a Shape-Profile-aware front patch instead of forcing an ellipsoid shell onto capsule, pear, bean, or rounded-cube bodies.

## All-part colors and expanded ranges

The Colors workspace covers body, limbs, paws, muzzle, nose, mouth, tongue, cheeks, eyes, highlights, ears, antennae, belly, tail glow, energy core, orbits, and symbols. Existing single-model links such as body/tail root, limbs/mid tail, and paws/warm tail tip are clearly disclosed in the UI.

Studio keeps expanded authoring ranges and reports likely intersections in Audit instead of silently clamping. Recipes and schemes remain local, with no upload, new browser permission, or background polling.
