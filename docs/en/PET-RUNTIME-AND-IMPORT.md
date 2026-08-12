# In-page pet runtime settings and appearance import

## 3D Zeph loading switch

The pet runtime card in the Side Panel provides a “Load 3D Zeph” switch.

- Enabled: the page loads `<yk-pet>`, TresJS, and the WebGL renderer on demand.
- Disabled: the current page immediately destroys the active 3D renderer and WebGL canvas, leaving a lightweight clickable Zeph entry. Page Audit, Pet Memory, Network Lab, and Local Agent remain available.
- Re-enabled: the extension recreates the renderer on demand and restores the saved appearance recipe.

The preference stays in `chrome.storage.local`; it is not uploaded and does not require a new extension permission.

Whenever “Load 3D Zeph” is enabled, the renderer keeps the established full visual configuration: the original DPR, frame-rate caps, two point lights, nebula glow, and emissive effects remain active. Motion type does not automatically reduce visual quality or remove lights.

## Idle motions

“Auto-play idle motions” is the master switch. When it is disabled, automatically scheduled motions do not enter the 3D renderer, while motions explicitly selected from the pet menu still play.

Every eligible motion can be selected individually. Recommended defaults keep lightweight and lifestyle motions, while high-energy and easter-egg motions are excluded from automatic playback by default but remain individually selectable. This setting only controls which motions may auto-play; it does not change model quality, lighting, DPR, or frame-rate caps.

## Studio appearance import

After a Studio JSON file is imported, the extension creates the model from the complete recipe instead of layering colors, belly patches, and symbols onto the default fox. The replacement consumes:

- body shape, body dimensions, and head scale;
- ears, eyes, nose, and mouth;
- front-paw style, limb length, thickness, and spacing;
- antenna rods, tips, spacing, and length;
- segmented tail geometry, root, direction, and tip glow;
- belly patch, energy core, chest/back symbols, and optional body orbits.

The built-in default recipe continues to use the existing full-motion model. Studio/import recipes use the full recipe-driven model; the two topologies are never rendered on top of one another.

## Manual acceptance

1. Disable “Load 3D Zeph” and confirm that the page canvas/WebGL context disappears while the lightweight entry still opens the menu.
2. Re-enable 3D without reloading and confirm that glow, lighting, sharpness, and motion smoothness match the previous full-quality rendering.
3. Disable idle motions, leave the page untouched for at least 30 seconds, and confirm that no automatic motion plays; manually selected motions must still work.
4. Select only “Wave” and confirm that no unselected motion auto-plays.
5. Import a Studio JSON recipe that clearly differs from the default model and verify that the body, head, eyes, ears, antennae, limbs, and tail all change—not only a symbol or belly patch.
6. Check all four views and high-energy motions in a real Chrome/WebGL environment; automated CI does not replace this visual acceptance step.
