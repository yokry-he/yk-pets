# Pet Customization Manual Acceptance

Automated CI cannot replace real browser and WebGL visual acceptance.

## Page layout

Check 1280, 1440, 1680, and 1920 pixel widths at 80%, 100%, and 125% browser zoom:

- title, search, save, and secondary actions do not overlap;
- navigation, preview, and inspector remain inside the viewport;
- only the inspector controls scroll while preview and motion toolbar stay stable;
- the schemes section is collapsed by default and does not squeeze controls when opened;
- the page-pet and highlight overlays are absent on the Studio editor;
- narrow and mobile breakpoints do not create page-level horizontal overflow.

## Independent head and body

- Select all six bodies and confirm the head remains unchanged.
- Select all six heads and confirm the body remains unchanged.
- At minimum, review classic-round with every body and rounded-square with every body.
- Import a legacy recipe without `headShape` and confirm migration to classic-round.
- Save, reload, export, and re-import, confirming both choices persist.

## Sole model and anchors

Review every body in all four views:

- no second torso layer, flickering seam, or internal shell appears;
- front paws, hind paws, tail root, energy core, and symbols fit the active silhouette;
- sphere, capsule, pear, bean, and rounded cube have clearly different outlines;
- limbs do not visibly float at parameter boundaries.

## Face

Review front, left, and right views:

- five noses do not intersect the mouth or muzzle;
- the classic mouth preserves the rounded mouth and tongue;
- cat, line, open, and pout mouths do not float in side views;
- spark and crystal diamond eyes are visibly different;
- sleepy eyes remain continuous curves rather than tiny points;
- pointer, ball, diving-catch, and fireworks gaze work for round and oval eyes.

## Belly patch

- The default belly is a solid ellipse, never a hollow ring.
- All ten shapes match their labels.
- Review color, size, position, rotation, and softness on all six bodies.
- The patch must not sink into the body center or visibly float.

## Motion and performance

- Play all thirty motions, emphasizing alternating fireworks paws, ball play, diving catch, cloud nap, backflip, and eating.
- Replaying the same motion restarts it.
- Switching views during motion does not change topology.
- Disabling 3D still destroys WebGL as before.
- No new permission, upload, or background polling appears.
