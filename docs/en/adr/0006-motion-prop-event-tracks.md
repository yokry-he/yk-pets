# ADR 0006: Motion Prop-Event Tracks

- Status: Accepted
- Date: 2026-07-25

## Decision

1. Motions reference stable prop asset IDs and distinguish multiple runtime instances with `instanceId`.
2. The event set is `create`, `show`, `attach`, `detach`, `move`, `hide`, `style`, and `destroy`.
3. Events use integer milliseconds and normalize by time and kind; the last input wins for the same time and kind.
4. The evaluator reduces events at resolved motion time into complete instance state: mount/world space, transform, color, opacity, glow, and particle rate.
5. Missing dependencies emit diagnostics without network requests or remote recovery.
6. Instances render inside the existing TresCanvas owned by `ExtensionAlignedCloudFox`; no second scene is created.

## Consequences

Motion Studio can author deterministic hold, throw, catch, and effect events. Instance geometry remains a local foundation preview until Prop Studio entity editing is completed next.
