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
- Prop assets, kind, default mount, anchors, and hierarchy foundation.
- Library viewing, contextual editing, and deletion.

## Not complete yet

Prop event tracks, same-scene instance preview, versioned component trees, geometry, materials, and internal-anchor editing are complete. Advanced animation tools remain incomplete. Future work must keep reusing the sole production renderer without copying topology or adding another long-running WebGL scene.

## Safety boundaries

No new Chrome permission, network upload, polling, WebSocket, or persistent configuration DOM is introduced.
