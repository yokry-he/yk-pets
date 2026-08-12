# Unified Cloud Fox renderer and lossless optimization

## One model and motion implementation

The default Zeph, the active Studio recipe, and imported JSON no longer select different models. They provide different recipe data to the same `apps/playground/app/components/studio/ExtensionAlignedCloudFox.vue` composition component:

```text
Default Zeph recipe ─┐
Studio recipe ───────┼─> unified Cloud Fox model + motion frame + effects
Imported recipe ─────┘
```

The default pet is therefore no longer a special hard-coded topology. It enters the same component as a normal default recipe and follows the same normalization, part assembly, and motion path as every other Cloud Fox recipe.

## High-altitude fireworks show

The previous production Chrome extension implementation is the sole authority for the high-altitude fireworks show and is preserved in the unified Cloud Fox component as the sole motion runtime:

- full 12-second duration;
- three consecutive high-altitude launches;
- 48 particles per burst;
- the original four curated palettes and four burst shapes;
- the original rocket, trail, stagger, gravity, and fade curves;
- upward head tracking toward the burst origin;
- synchronized eyes, antennae, and alternating front-paw salute.

Studio and the extension now call the same Vue/TresJS composition component. One shared plan supplies the random seed, launch origins, shapes, and palettes to the head, eyes, and particle component; the former Studio fireworks pool and algorithm have been removed from the generic effects layer, so only the production component is created and updated.

## Optimization without visual-quality reduction

This phase does not change:

- compact DPR `[0.75, 1]` or normal DPR `[0.9, 1.25]`;
- compact 30 FPS or normal 40 FPS;
- both point lights, cameras, FOV, or antialiasing policy;
- nebula glow, materials, model subdivisions, or fireworks particle count.

Optimization only removes work while the result is not visible:

1. stop the TresJS loop while the tab is hidden;
2. pause motion updates through `IntersectionObserver` while the pet is outside the viewport;
3. restart the current action cleanly through one shared motion token so background time cannot jump directly to the ending;
4. reuse fireworks directions, burst plans, and the fixed pool of 48 particle objects instead of recreating particles or duplicating head/eye/effect algorithms for each launch;
5. continue to destroy `<yk-pet>` and the WebGL scene when the user disables 3D.

## Manual acceptance

Automated CI does not replace real Chrome/WebGL visual acceptance. Verify at minimum:

1. the default Zeph and an imported classic recipe have the same structure in all four views;
2. the same Studio and extension recipe matches across body, head, ears, eyes, antennae, limbs, and tail;
3. Studio and extension fireworks have the same launch, burst, upward gaze, eye, and paw logic at equivalent phases;
4. returning from a background tab does not jump to the end and cleanly replays the current action from a stable start;
5. enabling 3D preserves image quality, lighting, glow, and particle density.
