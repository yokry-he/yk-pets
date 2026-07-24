# ADR 0001: Unified Studio Shell and Routed Workspaces

- Status: Accepted

## Context

Appearance, motion, and prop authoring use different interaction models. Putting everything into one page mixes navigation, inspectors, undo, and save semantics. Completely separate products would lose the active pet and asset context.

## Decision

Use one YK-PETS Studio product shell with `/studio/appearance`, `/studio/motion`, `/studio/props`, and `/studio/library`. Share local session and asset selections while keeping editor-specific state independent.

## Consequences

- Shared navigation and contextual jumps;
- clear appearance, motion, prop, and library boundaries;
- continued reuse of the sole production Cloud Fox renderer;
- routes, refresh, and browser history restore the active workspace.

## Rejected alternatives

- One expanding super-page;
- three completely separate applications;
- copied pet renderers for each workspace.
