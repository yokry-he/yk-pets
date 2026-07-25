# Unified Studio Workspace Manual Acceptance

Automated CI cannot replace real-browser layout, navigation, and WebGL acceptance.

## Routes and appearance

- Open `/studio` and confirm it redirects to `/studio/appearance`.
- Switch among all four workspaces and use Back/Forward. Refresh any workspace and confirm selections restore.
- Review 760, 920, 1180, 1440, and 1920 pixel layouts.
- Confirm complete appearance editing, import/export, undo/redo, and extension synchronization remain usable.

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

## Props and library

- Prop foundation assets, default mounts, and four anchors remain available.
- Prop events and geometry/material editing must not yet be described as complete.
- Deleting props clears motion dependencies; deleting selected assets clears shared selection.

## Local data, safety, and performance

- Verify v1-to-v2 migration, refresh restoration, and retained v1 rollback data.
- Confirm no new uploads, polling, WebSocket, or extension permissions.
- Repeatedly switch workspaces and confirm no extra WebGL scenes accumulate.
- Real Chrome Side Panel, GPU/WebGL depth ordering, and final pixels remain separate manual acceptance.
