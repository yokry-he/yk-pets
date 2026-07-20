# NOVA v0.6.2: Motion Switching and Mock Editor Fixes

## Release goal

This release fixes blank Network Lab rule editing, the persistent idle orbit, and unexpected motion switching while simplifying the motion menu.

## Network Lab

- Both Create Rule and Generate Rule from Request now open the full-page editor inside a stable Network Lab root.
- Entering the editor consistently selects the rules context, preventing a blank Side Panel caused by replacing the root node.
- Saving, canceling, and draft restoration continue to use the existing application service and repository without changing Mock safety boundaries.

## Motion cleanup

Spin, Play, Play Ball, and Paw Tap have been removed from the motion menu and automatic scheduling. The low-level protocol remains backward compatible so legacy states do not crash the extension.

## Cloud Nap

- Duration increases from 7.6 to 14 seconds.
- The body lies almost horizontally across the cloud, with synchronized head and body positioning.
- Damped entry and exit avoid an abrupt rotation.

## Interruption rules

1. Pointer enter greets only from a completely idle state.
2. Entering during another motion neither queues a greeting nor replays one after completion.
3. Directly selecting a new motion interrupts the active motion.
4. NOVA uses a 240ms neutral pose before starting the new motion, producing a controlled transition.

## Visual fix

Data orbits now appear only while thinking or while the Agent is working. Idle and lifestyle motions no longer retain a loading-like ring.
