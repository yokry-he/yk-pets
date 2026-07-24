# Unified Studio Workspace Manual Acceptance

Automated CI cannot replace real-browser layout, navigation, and WebGL acceptance.

## Routes and navigation

- Open `/studio` and confirm it only redirects to `/studio/appearance`.
- Switch among Appearance, Motion, Props, and Library; confirm the URL and active workspace match.
- Use browser Back and Forward; confirm workspace and context restore correctly.
- Refresh any workspace; confirm selected motion and prop remain selected.
- Review the top navigation at 760, 920, 1180, 1440, and 1920 pixel widths; it must not obscure the workspace's primary action.

## Appearance Studio migration

- Confirm identity, head, body, front and hind paws, belly, tail, antenna, colors, glow, symbols, and audit sections remain available.
- Confirm save, import, export, undo, redo, randomize, classic comparison, and local schemes still work.
- Model rendering, motion testing, and four views in `/studio/appearance` should match the pre-migration workspace.
- The shared Studio shell must not re-enable the page-pet overlay.

## Motion Studio foundation

- Create a motion and confirm it receives a stable ID.
- Change Chinese and English names, duration, and loop mode; refresh and confirm they persist.
- Select different motions and confirm the shared top context updates.
- Switch front, left, back, and right views while preserving the active appearance.
- Confirm timeline ticks change with duration.
- The current foundation must not imply that custom keyframes can already be written or played.

## Prop Studio foundation

- Create composite and effect props and confirm stable IDs.
- Change name, kind, and default mount; refresh and confirm they persist.
- Confirm internal anchors include at least origin, grip, display, and emitter.
- Use **Test in Motion Studio** and confirm the motion route opens while the current prop context remains selected.
- Disabled geometry buttons must not appear editable in this foundation phase.

## Asset Library

- Confirm the library shows the current appearance, the count of thirty built-in motions, custom motions, and custom props.
- Motion and prop edit actions must open the correct route and select the intended asset.
- Deleting a prop must remove that prop from motion dependency lists.
- Deleting the selected motion or prop must return the shared context to **Not selected**.

## Local data, safety, and performance

- Use developer tools to confirm no new uploads, polling, or WebSocket connections.
- Confirm extension permissions remain unchanged.
- Repeatedly switch workspaces and confirm multiple continuously running WebGL scenes do not accumulate.
- Review keyboard focus, accessible names, button states, and vertical scrolling on narrow layouts.
- With reduced motion enabled, top navigation and route changes must remain usable.
