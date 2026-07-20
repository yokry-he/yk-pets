# On-Demand Notices and Motion Runtime

Version: `0.2.6`

## Goals

v0.2.6 addresses two issues:

1. The large status bubble should not remain visible whenever the function menu is open.
2. Motion controls must reliably restart 3D animations, including repeated clicks on the same motion.

## On-demand notices

The status bubble is hidden by default and appears only for events such as:

- page audit start or completion;
- element location, preview, and rollback results;
- Local Agent patch, verification, and rollback tasks;
- errors or other states that require user attention.

Normal results remain visible for roughly 4.8–5.2 seconds, while errors remain for roughly 8 seconds. In-progress tasks keep the notice visible, but the user may still close it manually.

The notice contains only a two-line summary and the current issue name. When more information exists, it provides an “Open details in side panel” action. Full issue lists, diffs, command output, and error details remain in the Side Panel.

## Layer separation

The notice, mode switch, and radial controls use separate layout layers:

- without a notice, the function/motion switch stays at the top of the interaction area;
- while a notice is visible, the switch and menu-close button move down automatically;
- after the notice closes, controls return to their normal positions;
- the notice may overlay host content but does not reserve permanent space.

## Reliable motion restarts

Changing only `behavior` cannot restart the same motion twice because the state value may remain unchanged.

v0.2.6 introduces `motionKey`:

```text
motion button click
  → motionNonce + 1
  → AvatarCanvas.motionKey
  → CloudFox.motionKey
  → reset behaviorStartedAt
```

Repeated clicks on Jump or Spin therefore restart the animation timeline from zero.

## Motion feedback

Manual motions no longer open the large notice. A compact label appears near the pet for about 1.5 seconds, for example:

```text
跳跃 · Jump
```

Idle motions do not show labels, keeping the experience unobtrusive.

## State priority

```text
audit or Agent busy state
  > manual motion
  > idle carousel
  > default page-health behavior
```

Busy states stop manual motion and idle playback. Idle scheduling resumes only after the task completes.
