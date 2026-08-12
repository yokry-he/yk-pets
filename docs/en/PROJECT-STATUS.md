# Current YK-PETS Project Status

## 1. Baseline

- Stable reference: `v0.6.10`;
- development branch: `agent/cloud-fox-studio-v0610`;
- Pull Request: `#7`, targeting `agent/yk-pets-rebrand-v0610`;
- product brand: YK-PETS;
- default pet: Zeph, a Cloud Fox;
- current phase: `browser-acceptance-and-release-hardening`;
- this file describes capability boundaries and does not replace live GitHub HEAD, PR, or CI state.

## 2. Current deliverables

- Chrome/Edge Manifest V3 extension;
- Nuxt Playground, audit lab, and four-workspace Pet Studio;
- token-authenticated local WebSocket Agent;
- framework-neutral `pet-core`;
- Vue renderer adapter and `<yk-pet>` Web Component shell;
- bilingual product, architecture, security, protocol, and acceptance documentation.

## 3. Completed capabilities

The extension provides page audits, scoring, issue navigation, highlighting, reversible DOM previews, Fetch/XHR capture and mocking, whole-JSON transformations, conflict analysis, Pet Memory, runtime preferences, Side Panel workflows, and Local Agent patch generation, application, checks, and rollback.

The pet runtime reuses one production Cloud Fox renderer across Playground and extension. It supports Zeph's motion, dragging, menus, notices, voices, idle behavior, versioned appearance recipes, extension synchronization, runtime preferences, appearance import, storage migration, and species fallback experiments.

Pet Studio now includes complete appearance editing; schema-v2 motion assets with millisecond timing, FPS display grids, timeline authoring, curves, layers, IK, audio, prop events, and direct controls; schema-v2 parametric prop entities with hierarchy, materials, anchors, budgets, and safe local GLB; and a shared asset library with persistence, migration, import/export, and dependency cleanup.

The framework-neutral core provides species and recipe contracts, renderer registration, Studio sync, `cloud-fox-semantic-rig/v1`, deterministic interpolation and time resolution, motion editing and evaluation, symmetry, layers and whole-clip correction, prop entities and events, a Vue adapter, and a foundational Web Component.

## 4. Explicitly incomplete

- Browser screenshot baselines and multi-resolution visual regression;
- complete manual acceptance for real Chrome Side Panel, GPU, WebGL, audio gestures, and complex GLB;
- true model raycasting and a three-axis 3D gizmo;
- advanced curve interpolation for prop events.

Static contracts and numeric tests must not be described as completed real-browser acceptance.

## 5. Compatibility boundary

Legacy `Nova*` aliases, `NOVA_*` wire values, `@nova/*` Workspace scopes, `nova:*` storage mirrors, `.nova/agent.json` migration and patch backups, and the `nova-agent` CLI alias remain where needed for `v0.6.10` compatibility. User-facing branding, new domain models, and the primary CLI use YK-PETS. Legacy identifiers must not spread into new public APIs.

## 6. Quality baseline

Automated validation covers domain unit tests, Local Agent patch tests, Cloud Fox numeric surface tests, Pet Memory import tests, and focused gates for branding, documentation, architecture, motion, props, and rendering.

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm build:playground
```

The current worktree or latest complete CI run is the source of truth for pass status.

## 7. Next phase

1. Complete real-browser acceptance for Studio routes, timeline, props, audio, GLB, and responsive layout.
2. Validate the production Side Panel and page-overlay path.
3. Establish screenshot baselines and multi-viewport regression.
4. Fix acceptance findings and update release documentation.
5. Design true raycasting and 3D gizmo work as a separate batch.

## 8. Trust order

When information conflicts, trust actual code and runtime results, the latest complete CI, `.ai/project-state.json`, accepted ADRs and AI handoff, the PR description, and old chat history in that order.
