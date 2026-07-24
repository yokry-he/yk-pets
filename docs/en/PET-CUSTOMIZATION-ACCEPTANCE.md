# Pet Customization Manual Acceptance

Automated CI cannot replace real Chrome, WebGL, browser zoom, four-view, and motion-visual checks.

## Studio layout

- Open `/studio` at 1280, 1440, 1658, and 1920 widths. Title, search, and actions must not overlap or float outside the top container.
- Test 80%, 100%, and 125% browser zoom. Navigation, preview, and inspector must remain usable.
- Expand **Schemes and recent changes** and confirm the parameter region can still scroll independently to the bottom.
- The main Studio page must not show the fixed **Presets and styles** shortcut or the webpage-pet overlay.
- Verify search, classic comparison, hotspots, scheme save/apply/delete, `/`, and `Escape`.

## Sole face hierarchy

- Review all five noses in front, left, and right views. Each nose must sit on the muzzle surface without intersecting or floating over the mouth.
- The default smile must restore the original production Cloud Fox rounded mouth and tongue.
- Review cat, line, open, and pout styles. Side views must not show thick torus pieces hanging vertically from the face.
- Play Idle, Talking, Eating, Happy, and Sparkle Sneeze. Face parts must follow one head-motion space.
- Change muzzle, nose, mouth, tongue, and cheek colors. No legacy face part should show through underneath.

## Eyes

- Spark eyes must show crossed star blades; crystal-diamond eyes must show a vertical faceted crystal. They must not share the same silhouette.
- Round and oval eyes must keep pointer, ball, diving-catch, and fireworks gaze behavior.
- Spark, diamond, and visor eyes must not receive an extra circular gaze overlay.
- Sleeping, blinking, confused, and excited states must still affect the eyes.

## Six body and head forms

- Select sphere, ellipsoid, capsule, pear, bean, and rounded cube. Front and side silhouettes must be immediately distinguishable.
- Sphere should be near-uniform, capsule should have a straighter center and round ends, pear should be bottom-heavy, and bean should show a tilted two-lobe outline.
- Rounded-cube body and head must both be rounded-square rather than keeping an obvious spherical head.
- Inspect ears, eyes, muzzle, paws, hind limbs, belly, and tail root on every body shape.
- Play common motions and confirm the new outer silhouettes do not hide limbs or break the tail.
- Check all four views and automatic camera fitting for clipping.

## Belly, colors, and ranges

- Defaults must restore an ellipse belly. Review all ten labels and silhouettes.
- On all six bodies, test belly position, color, width, height, rotation, and softness. Side views must not show the old ellipsoid shell.
- Change every color channel and verify matching output in Studio and the Chrome extension.
- Move body, head, limbs, ears, eyes, tail, antennae, and belly to expanded-range boundaries. Audit should report risk instead of silently reverting values.
- Save, reload, export, and re-import; all settings must persist.

## Safety boundaries

- Confirm no new Chrome permission, upload, or background polling.
- Confirm Network Lab, Pet Memory, Page Audit, and Local Agent workflows remain available.
- Disabling 3D must still destroy WebGL; re-enabling must restore the current formal recipe.
