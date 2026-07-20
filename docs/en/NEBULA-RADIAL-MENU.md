# Nebula Transparency and Radial Function Menu

## 1. Goal

v0.2.2 changes in-page NOVA from “a pet beside a tool panel” into “functions orbiting the pet.” The cloud fox remains the visual center while actions appear as orbital nodes around it.

The design addresses four concerns:

- Reduce obstruction caused by dark rectangular panels on host pages.
- Show the fox's full body, tail, floating platform, and data orbits.
- Add life through a nebula, stars, and energy pulses without large image assets.
- Make temporary-preview rollback reliable even when the active issue changes after previewing.

## 2. Transparent nebula layer

The cloud-fox Canvas remains transparent. CSS radial gradients expand from the animal and fade to full transparency:

```text
Pet body
  ↓
Near-field white glow
  ↓
Purple and cyan nebula
  ↓
Low-opacity mist edge
  ↓
Full transparency
```

The nebula layer follows these constraints:

- `pointer-events: none` so it never blocks the host page.
- No extra WebGL scene or texture resource.
- Opening the menu increases range and opacity without introducing an opaque panel.
- Star drift and pulse animation stop under `prefers-reduced-motion: reduce`.

## 3. Full-body framing

Compact mode uses a lower camera Y coordinate, a greater Z distance, and a slightly wider FOV. The intended frame includes:

- ear tips
- the complete head and body
- both front paws
- the end of the tail
- the floating platform
- data orbits

Mobile layouts use a smaller container but preserve the same full-body framing instead of falling back to a cropped portrait.

## 4. Semi-radial quick menu

On desktop, six high-frequency functions expand along a semicircular orbit above and to the left of the fox:

1. Page audit
2. Previous issue
3. Next issue
4. Preview fix / Undo preview
5. Detailed report
6. Engineering tools

Actions use circular orbital nodes rather than a fixed rectangular menu. Absolute positioning creates the semicircle, and nodes enter with short staggered animations.

Narrow or short viewports switch to a three-column grid above the fox instead of forcing the radial layout beyond the viewport.

## 5. Second-layer engineering tools

Selecting Engineering Tools collapses the primary orbit and opens a translucent capsule track containing:

- Connect Local Agent
- Generate source patch
- Confirm patch write
- Run project verification
- Roll back latest patch
- Return to quick orbit

Source-writing actions continue to use the existing confirmation, hash verification, backup, and rollback protections.

## 6. Energy interaction feedback

Clicking the pet or any animal action emits one energy pulse from the fox's center:

- The initial size is approximately 45% of the pet's central area.
- It expands to 180% over roughly 620ms.
- Opacity fades to zero.
- The DOM node is removed after the animation ends.

Stars provide ambient breathing motion; the energy pulse explicitly confirms that the animal received a command.

## 7. Preview rollback guarantees

Temporary preview rollback uses three levels of fallback:

1. Restore the snapshot matching the active issue ID when it exists.
2. If the issue ID changed but an active snapshot remains, restore all active snapshots.
3. When no snapshot exists, report that there is no temporary preview to undo.

Applying a new preview first rolls back the old preview. This keeps at most one NOVA temporary mutation active and avoids ambiguous restoration ordering.

## 8. Accessibility

- Every radial button has an independent `aria-label`.
- Double-click and right-click are accelerators only; clickable buttons expose every function.
- Keyboard focus feedback combines borders and glow rather than relying on color alone.
- Under reduced-motion preferences, actions appear immediately without orbital animation.

## 9. Two-layer WebGL transparency guarantee

v0.2.4 no longer relies only on a transparent CSS background. It applies transparency at two renderer levels:

- `clear-alpha="0"` is passed directly to `TresCanvas`.
- The `ready` event calls `renderer.setClearColor(0x000000, 0)` again once the renderer is available.

The previous `created` listener was not a valid readiness event for the current TresCanvas version, so the callback never ran in some environments and a black clear rectangle remained visible. Switching to `ready` makes transparent clearing reliable.
