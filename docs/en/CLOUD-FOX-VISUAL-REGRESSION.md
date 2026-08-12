# Cloud Fox Visual Regression Contract

## Validation levels

Cloud Fox visual changes must pass three distinct levels. A source branch existing is no longer treated as visual completion:

1. **Structural validation**: one renderer, independent head and body recipes, no duplicate torso, and no permission expansion.
2. **Numeric visual validation**: surface distance, normals, projected screen size, and geometry depth variation stay within defined thresholds.
3. **Real-browser acceptance**: fixed-URL screenshots, three-view attachment checks, multiple viewport sizes, and motion review.

A green automated CI run proves only the first two levels. It does not claim that real Chrome/WebGL acceptance is complete.

## Real surface sampling

`cloud-fox-surface-model.ts` is the sole mathematical source for torso and head attachments:

- six bodies use `sampleCloudFoxBodyFrontSurface()`;
- six heads use `sampleCloudFoxHeadFrontSurfaceAtLocalXY()`;
- eyes use `resolveCloudFoxEyeSurfaceAnchor()` and move slightly outside the shell along the sampled normal;
- the belly uses `createCloudFoxBellySurfaceMesh()` to project every vertex onto the torso;
- the extension consumes the same domain through thin export bridges.

The belly no longer relies on a fixed Z value, plane scaling, or generic curvature. Eyes no longer rely on a fixed `eyeZ`.

## Numeric regression test

`pnpm test:cloud-fox-surface` verifies:

- every belly vertex on all six bodies keeps the shared small offset from the sampled surface;
- belly normals are normalized and face the torso front;
- the belly has a visible but bounded projected size under the production camera;
- side-view depth must vary, preventing regression to a floating flat panel;
- eyes on all six heads remain outside the shell and face the camera;
- spark, crystal, and sleepy eyes keep minimum screen sizes and blink floors.

## Deterministic visual audit route

Open:

```text
/studio-visual-audit?body=ellipsoid&head=classic-round&eyes=spark&belly=ellipse&view=front
```

Supported parameters:

- `body`: one of the six body IDs;
- `head`: one of the six head IDs;
- `eyes`: one of the six eye IDs;
- `belly`: one of the ten belly IDs;
- `view`: `front`, `left`, `back`, or `right`.

The route fixes the classic recipe, Idle motion, dark background, production camera, and canonical Studio canvas. Its `data-case-id` can become the filename for future browser screenshot baselines.

## Mandatory manual cases

After changing body, head, eyes, belly, camera, or anchors, review at minimum:

- spark and crystal eyes on classic-round and rounded-square heads in front, left, and right views;
- the default ellipse belly on all six bodies in front and side views;
- minimum and maximum belly sizes on ellipsoid, pear, bean, and rounded cube;
- the classic default appearance in all four views and during Idle, Talking, and Eating;
- visual parity between Studio and the Chrome extension using the same recipe.
