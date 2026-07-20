# NOVA v0.6.1: Motion Queue, Active Glow, and Side-Lying Cloud Nap

## 1. Goal

v0.6.1 prevents hover from interrupting active motions, removes abrupt motion switching, increases idle activity, connects the antennae to the head, introduces directly controllable glow motions, and rebuilds cloud nap as an actual lying pose.

The release follows three principles:

1. A primary motion should finish; hover remains a low-priority intent.
2. A short neutral settling pose separates consecutive motions.
3. Antennae, tail, and chest core can glow both through state linkage and explicit menu actions.

## 2. Queue and priority

Requests use this priority order:

1. System state
2. User-triggered motion
3. Menu or UI feedback
4. Hover
5. Idle motion

A new request no longer clears the active timer. One pending request is retained, preferring the newest request at the highest priority.

### Hover

- Hover waves only when the pet is fully idle.
- Hover never replaces or restarts an active motion.
- Pointer leave resets gaze only; it does not force a pose reset.
- One continuous hover session produces at most one greeting.

### Transition

After a motion ends, NOVA uses a roughly 260ms neutral settling stage. Damped rigs can finish returning the shoulders, paws, head, tail, and body rotation before the next queued motion starts.

## 3. Idle cadence

| Tier | New interval | Purpose |
|---|---:|---|
| Normal | 10–18 seconds | Wave, jump, curious scan, paw tap, and other light actions |
| Lifestyle | 34–64 seconds | Ball, meal, juggling, nap, antenna charge, and similar actions |
| High energy | 100–180 seconds with probability gate | Backflip, tail tornado, energy burst, and related shows |
| Easter egg | 150–300 seconds with a low-probability gate | Fireworks, sparkle sneeze, and rare surprises |

Scheduling still pauses while the menu is open, the Agent is busy, the tab is hidden, or reduced motion is enabled.

## 4. New motions

### Curious Scan

The pet tilts its head and scans both sides while eyes, head, and antennae move at slightly different phases.

### Paw Tap

The shoulder remains planted. Forearm and paw tip create a light ground tap, producing a small energy ripple.

### Antenna Charge

Both antennae converge. Antenna tips, chest core, and data rings increase brightness together, followed by a strong pulse and ground ring.

### Tail Glow Flow

The middle and tip materials enter an active emissive state. Energy flows toward the tip while the tip pulse, trail, and stardust intensify.

## 5. Antenna geometry

The antenna root moves from local head Y=0.98 to Y=0.70. Shorter stems embed their lower ends into the head surface, removing the visible gap in front and side views.

## 6. Cloud nap

Cloud nap is now a clear side-lying pose:

- the full Action Rig rotates sideways by about 1.28 radians;
- the body lowers and stretches horizontally;
- front and hind paws tuck toward the body;
- the head rests close to the cloud with closed eyes;
- the cloud is raised to support the rotated body;
- sleep particles rise beside the head;
- the tail retains only a slow breathing motion.

## 7. Reduced motion

Reduced-motion mode preserves readable poses and low-intensity glow while continuing to simplify large translations, fast rotations, and broad particle effects.

## 8. Visual acceptance

1. Repeated pointer enter/leave during fireworks, ball play, or backflip must not restart or stop the motion.
2. Triggering two motions should play the second only after the first settles.
3. A normal idle action should occur within 10–18 seconds on an unobstructed idle page.
4. Antenna roots must visibly meet the head surface.
5. Antenna Charge and Tail Glow Flow must be manually triggerable from the motion menu.
6. Cloud Nap must clearly show the pet lying on its side.
