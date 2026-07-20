# NOVA Motion Controls and Idle Carousel Design

## Goal

v0.2.5 separates website tools from pet performances into two explicit modes. This prevents the status bubble, orbit buttons, and pet body from covering each other while allowing users to directly control NOVA's animations.

## Layered layout

The desktop overlay uses a transparent 440 × 500 pixel interaction coordinate system:

1. The status bubble occupies the dedicated top region.
2. The Features / Motions switch sits below the bubble.
3. Orbit buttons expand around the pet's left and upper sides.
4. The pet stays in the lower-right region.
5. Engineering tools use an independent panel and never appear together with the orbit buttons.

A minimum 12-pixel safety gap is maintained between the status bubble and the highest orbit button. The orbit also avoids the pet's face and body center.

## Direct motion controls

Motion mode exposes six buttons:

| Motion | Behavior | Main expression |
|---|---|---|
| Wave | `greeting` | Raises the right paw, gently moves the head, and smiles |
| Jump | `jumping` | Anticipation, launch, airborne stretch, and landing squash |
| Spin | `spinning` | Rotates around the Y axis while the tail balances the body |
| Flap | `flapping` | Alternates both front paws with faster ear responses |
| Play | `playing` | Side movement, body sway, and fast tail motion |
| Rest | `resting` | Lowers the body and head while folding the tail inward |

Motion buttons only change the pet's allowlisted behavior state. They do not run page audits, modify the DOM, or invoke local project operations.

## Idle animation carousel

The idle carousel starts only when all conditions are true:

- The function menu is closed.
- The document is visible.
- NOVA is not running an audit, preview, patch, or project verification task.
- The user has not interacted with the pet for 9 to 17 seconds.

The carousel randomly chooses Wave, Jump, Spin, Flap, or Play and avoids repeating the previous motion. Rest is manual-only so the pet does not remain lying down for long periods.

The timer is paused or reset when:

- The function menu opens.
- Any tool or motion button is pressed.
- The pet is dragged.
- The document moves to a background tab.
- An audit or Local Agent task becomes busy.

## State priority

Visible behavior follows this priority:

1. Audit and Agent busy states.
2. User-triggered motions.
3. Idle carousel motions.
4. Default behavior derived from page health.

When a busy state begins, manual and idle animations are cleared so NOVA never spins or plays while presenting itself as running a build.

## Accessibility and reduced motion

Every motion control is a native button and remains keyboard accessible. With `prefers-reduced-motion`, CSS star, orbit-entry, and energy-pulse animations stop. The 3D pet keeps basic state feedback but should not continuously run high-frequency idle performances.
