# Unified Studio Workspace Manual Acceptance

Automated CI cannot replace real-browser layout, navigation, and WebGL acceptance.

## Routes and appearance

- Open `/studio` and confirm it redirects to `/studio/appearance`.
- Switch among all four workspaces and use Back/Forward. Refresh any workspace and confirm selections restore.
- Review 760, 920, 1180, 1440, and 1920 pixel layouts.
- Confirm complete appearance editing, import/export, undo/redo, and extension synchronization remain usable.

## Preview orientation across all three studios

- In Appearance, Motion, and Prop Studio, drag horizontally and vertically inside the pet preview and confirm continuous free rotation.
- After free rotation, select Front, Left, Back, and Right in turn. Each selection must land directly on the exact canonical view without retaining the drag offset.
- From any canonical view, drag again and click the already-active view button. It must still clear the offset and restore the exact view.
- Confirm appearance hotspots, the Motion direct-control area, and the prop mount badge remain usable, with no horizontal overflow at narrow widths.
- Confirm all three toolbars use the same two-level Canonical Views and Preview Transform grouping, with background, scale, X/Y/Z, and reset aligned consistently; only Motion Studio adds preview time.
- At 760, 920, 1180, and 1920 pixels, verify clean wrapping without covering the pet or Motion direct controls and without horizontal scrolling.

## Motion Studio

- Create a motion and confirm a stable ID.
- Edit names, duration, FPS, and loop mode.
- Write root, body, head, limb, ear, eye/mouth, tail, and antenna keyframes.
- Verify delete, copy, paste, drag, multi-select, undo, and redo.
- Verify FPS snapping and exact millisecond input.
- Verify `once`, `loop`, and `ping-pong` playback.
- Save, refresh, and confirm restoration.
- Confirm body and belly move together and unauthored channels retain breathing, blinking, and gaze.
- Confirm the thirty built-in motions do not regress.
- At multiple playhead positions, key head, eye/mouth, nose, and tail scale, spacing, expression tilt, sniff, glow, mouth curve, tail length, and fluff. Playback must interpolate smoothly and stop at the base appearance.
- Copy and play Energetic Step (8s), Starlight Sway (10s), Horse Stance Combination (8.4s), Nebula Staff Combination (12s), Agile Gymnastics Combo (8.8s), and Sprint Stop Challenge (9.2s). Observe preparation, main phrases, transitions, climax, and recovery; confirm weight, head, limbs, ears/tail, gaze, and expression coordinate with visibly different strike and hold timing.

## Props and library

- Prop foundation assets, default mounts, and four anchors remain available.
- Prop events and prop entity editing are implemented, but real browser/WebGL, depth ordering, and advanced animation tools must not be described as accepted.
- Deleting props clears motion dependencies; deleting selected assets clears shared selection.
- Confirm Nebula Staff, Energy Sword, Starlight Fan, Twin Glow Sticks, Nebula Ribbon, and Energy Orb appear in the library and copy into Prop Studio without mutating the templates.
- Play Nebula Staff Combination and Starlight Sway; their staff and glow sticks must appear, attach, change glow and particle emphasis at multiple climax events, and be destroyed at the end in the production preview scene.

## Expression shapes

- Across all six head shapes, inspect happy crescent, angry sharp, sad droop, surprised, heart, and dizzy spiral eyes from front and both sides.
- Inspect cat, crystal, and starlight noses for muzzle-surface fit, glow, and animated scaling.
- Confirm legacy eyes/noses, blinking, independent closures, and gaze channels do not regress.

## Local data, safety, and performance

- Verify v1-to-v2 migration, refresh restoration, and retained v1 rollback data.
- Confirm no new uploads, polling, WebSocket, or extension permissions.
- Repeatedly switch workspaces and confirm no extra WebGL scenes accumulate.
- Real Chrome Side Panel, GPU/WebGL depth ordering, and final pixels remain separate manual acceptance.
