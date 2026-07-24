# Unified Studio Workspace Architecture

## Product structure

YK-PETS Studio uses one product shell while separating creation tasks into routed workspaces:

- `/studio/appearance`: Appearance Studio;
- `/studio/motion`: Motion Studio;
- `/studio/props`: Prop Studio;
- `/studio/library`: shared Asset Library.

The legacy `/studio` route only redirects to Appearance Studio. All four workspaces share product navigation and selected asset context, but editor-specific undo histories remain independent.

## Shared context

`StudioSession` persists:

- selected appearance asset ID;
- selected motion asset ID;
- selected prop asset ID;
- preview view;
- preview background;
- most recently used workspace.

This context remains on the local device. Refreshing a page or moving between workspaces does not discard the active asset selection.

## Asset boundaries

Appearance, motion, and prop definitions are independent asset types:

- appearance describes base structure, colors, and the static default pose;
- motion describes relative poses, duration, loop behavior, and prop dependencies;
- prop describes asset kind, default mount, and internal anchors.

A motion references prop IDs and does not mutate the prop definition. Prop Studio can jump to Motion Studio for testing, and Motion Studio can jump back to a referenced prop.

## Current foundation batch

This batch includes:

- shared Studio navigation;
- four independent routes;
- local session store;
- motion and prop metadata store;
- motion creation, naming, duration, and loop mode;
- prop creation, type, default mount, and internal anchors;
- viewing, contextual editing, and deletion in the Asset Library;
- lossless migration of the complete Appearance Studio;
- compatibility for existing `/studio` links.

## Not complete yet

Motion Studio currently provides asset and timeline foundations. It does not yet write keyframes, interpolate tracks, edit curves, or author prop events. Prop Studio currently provides asset, mount, and hierarchy foundations. It does not yet edit geometry, materials, or grip transforms.

Future work must continue to reuse the sole production Cloud Fox renderer. Motion and prop authoring must not copy a second pet topology.

## Safety boundaries

This batch adds no:

- Chrome permission;
- network upload;
- background polling;
- WebSocket;
- persistent configuration DOM in host pages;
- second continuously running WebGL scene.
