# NOVA Cloud Fox Tail Design

## 1. Current problem

The previous tail used one Torus geometry. It was inexpensive to render, but it introduced several visual and motion problems:

- Its silhouette looked like a plastic tube rather than a fox tail.
- Root, middle, and tip had nearly the same thickness, with no organic taper.
- The whole tail rotated as one rigid part.
- The glowing tip had no material transition from the body.
- From the front, the circular silhouette competed with the body and reduced character readability.

## 2. Recommended direction: segmented flexible cloud tail

v0.2.4 uses a three-part flexible cloud tail:

1. **Root segment**: thick and low-saturation, connecting naturally to the body.
2. **Middle segment**: gradually tapered and curved upward into a soft fox-like S silhouette.
3. **Energy tip**: cyan-purple emissive material with a soft energy orb and a low-opacity outer glow.

Each segment uses its own Catmull-Rom curve and TubeGeometry instead of one complete ring. The middle and tip are nested joints, allowing delayed follow-through.

### Motion rules

- The root moves first, the middle follows with a phase delay, and the tip follows later.
- Happy, playful, and jumping states increase speed and amplitude.
- Thinking reduces root movement but strengthens the tip energy pulse.
- Resting and sleeping fold the tail slightly toward the body.
- The tip also moves lightly on the Y axis so the motion is not restricted to a flat plane.

### Material rules

- Root: body shadow color with higher roughness.
- Middle: primary coat color for a natural brightness transition.
- Tip: cyan emissive energy material.
- Outer glow: a low-opacity purple sphere without image textures.

## 3. Alternative A: liquid light ribbon

Use a translucent ribbon or shader-driven light trail to reinforce the “digital life” identity.

Advantages:

- Strongest technical and futuristic character.
- Supports shader flow, noise, and data pulses.
- Matches the nebula background language well.

Trade-offs:

- Weakens the fox silhouette.
- Shader transparency and sorting add mobile cost.
- Requires extra contrast handling on light pages.

Best reserved for secret or high-energy modes rather than the default state.

## 4. Alternative B: layered fluffy tail

Use one large solid fluffy tail with a smaller translucent energy core inside it.

Advantages:

- Strongest fox recognition.
- More friendly and cute.
- Maps naturally to a future skeletal GLB model.

Trade-offs:

- Procedural geometry cannot reproduce real fur easily.
- The larger volume may cover the body and action controls.
- Framing, shadows, and interaction bounds become more demanding.

## 5. Alternative C: multi-tail form

Keep one tail normally and expand into three or five energy tails in secret mode.

Advantages:

- Highly memorable high-energy state.
- Individual tails could represent performance, accessibility, errors, networking, and other capabilities.
- Strong for demos and product marketing.

Trade-offs:

- Too visually dense for an always-on state.
- Motion and rendering cost rise significantly.

Recommended only for `secretMode` or short celebration sequences after a successful audit.

## 6. Recommended evolution

- v0.2.4: default segmented flexible cloud tail.
- v0.3.x: add liquid-ribbon or three-tail expansion in secret mode.
- v1.0: preserve the same root/middle/tip animation semantics when switching to a skeletal GLB model.

This direction provides the best balance of fox recognition, motion quality, performance, and implementation cost for the current procedural model.
