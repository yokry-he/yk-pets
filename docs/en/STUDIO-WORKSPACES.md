# Unified Studio Workspace Architecture

YK-PETS Studio uses one product shell with `/studio/appearance`, `/studio/motion`, `/studio/props`, and `/studio/library`. `/studio` only redirects for compatibility. Workspaces share local asset selection, view, and background while editor undo histories remain independent.

## Asset boundaries

- Appearance: base structure, colors, and static default pose.
- Motion: relative semantic poses, millisecond timing, loop, interpolation, and prop dependencies.
- Prop: asset kind, default mount, component hierarchy, and anchors.

Motions never mutate appearance recipes. Motions reference stable prop IDs and do not mutate prop definitions.

## Current capabilities

- Lossless migration of the complete Appearance Studio.
- Motion v2 assets, independent drafts, undo/redo, playhead, and playback controls.
- Keyframe write, delete, copy, paste, move, multi-select, and `step`/`linear`.
- Once-per-frame semantic pose evaluation through the sole production Cloud Fox renderer.
- Appearance, Motion, and Prop Studio share one preview-orientation controller: canvas dragging applies a free rotation, while Front, Left, Back, or Right first clears that offset and then selects the exact canonical view.
- All three studios reuse one preview toolbar grouped into Canonical Views and Preview Transform, with background, 40%–120% scale, three-axis angles, and reset. Motion Studio adds preview time within the same layout.
- Appearance Studio adds happy, angry, sad, surprised, heart, and dizzy eyes plus cat, crystal, and starlight noses, all mounted through the canonical parametric head surface.
- The motion Rig adds safe animated channels for head scale, eyes, pupils, spacing, nose deformation, mouth curve, tail length/fluff, and antenna glow while reusing current-frame, selected-keyframe, and whole-clip commands.
- The library exposes six read-only long-form motion templates and six built-in props. Each 8–12 second template coordinates 15–16 semantic channels across 163–272 keyframes and is structured into preparation, main phrases, transitions, climax, and recovery. Copies become user assets, while the staff-combination and starlight-sway templates preview their built-in props directly.
- Prop assets, kind, default mount, anchors, and hierarchy foundation.
- Library viewing, contextual editing, and deletion.

## Not complete yet

Prop event tracks, same-scene instance preview, versioned component trees, geometry, materials, and internal-anchor editing are complete. Advanced animation tools are also implemented under automated coverage. Remaining work is real-browser acceptance and release hardening, still without copying topology or adding another long-running WebGL scene.

## Safety boundaries

No new Chrome permission, network upload, polling, WebSocket, or persistent configuration DOM is introduced.
