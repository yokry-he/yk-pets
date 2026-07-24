# ADR 0003: Prop Assets, Instances, and Anchors

- Status: Accepted

## Context

Motions need to hold, throw, and trigger props, but temporary animation transforms must not corrupt the base prop definition. Arbitrary remote model import would also introduce permission, security, and performance risks.

## Decision

- Prop definitions are separate from prop instances in motions.
- Motions reference assets through stable prop IDs.
- Every prop has at least `origin`, `grip`, `display`, and `emitter` anchors.
- A motion may animate instance position, rotation, scale, color, glow, and attachment without mutating the prop asset.
- The first Prop Studio uses parameterized primitive geometry and local materials.
- GLB import requires a separate security, resource-budget, and compatibility decision.

## Consequences

The same prop can be reused by multiple motions while asset updates and instance events remain separate. Deleting a prop must validate and clean motion dependencies.

## Rejected alternatives

- Copying complete prop definitions into motion files;
- allowing motions to mutate prop assets;
- arbitrary remote models or scripts in the first release;
- world-coordinate guesswork instead of stable grip anchors.
