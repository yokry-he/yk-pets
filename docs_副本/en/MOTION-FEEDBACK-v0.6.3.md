# NOVA v0.6.3: Rule Creation, Motion Audio, and Thought Bubbles

## Rule creation fixes

- The rule editor unwraps Vue proxies before cloning, preventing `structuredClone` from throwing `DataCloneError`.
- Both Create Rule and Generate from Request now pass an executable regression through the real editor state machine.
- New flows no longer silently restore stale drafts. A stored draft loads only after the user selects the explicit restore entry.
- Draft validation now requires a complete rule name, site scope, URL, method list, and action type.
- Child editor failures render a visible error boundary with a return action instead of an empty workspace.
- The unsafe TresJS ready callback that could call `setClearColor` on a non-renderer object has been removed.

## Motion interaction

- Selecting the same active or transitioning motion does not restart animation or replay audio.
- Selecting another motion interrupts through a 240ms neutral pose before the new motion begins.
- Pointer hover records gaze intent only. It never starts, interrupts, or queues a behavior, and active motions isolate pointer-driven gaze.
- Every retained motion is longer. Cloud Nap is now a flat lying pose lasting 18 seconds.

## Audio and thought bubbles

- All 18 retained motions have distinct local Web Audio pitch patterns and require no remote media files.
- The audio context is first created after a direct user motion selection, respecting browser autoplay restrictions.
- Starting a motion opens a thought bubble above the pet with the motion name and a dedicated Chinese caption.

## Validation

- v0.6.3 targeted static regression: 16/16.
- Real rule-editor state-machine regression: both manual creation and request-derived creation pass.
- Extension Vue TypeScript validation passes.
