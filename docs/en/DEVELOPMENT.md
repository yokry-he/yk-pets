# Development and Runtime Guide

## 1. Requirements

- Node.js 22 or newer;
- Corepack and pnpm 11.13.1;
- Chrome or Edge with Manifest V3 Side Panel support;
- a working WebGL environment for 3D pages.

See the [technology stack](./TECH-STACK.md) and [technical architecture](./ARCHITECTURE.md) for dependency and module boundaries.

## 2. Install

```bash
corepack enable
pnpm install --frozen-lockfile
```

Use the package manager declared by the root lockfile. Do not install workspace dependencies separately with npm or yarn.

## 3. Start the development environment

```bash
pnpm dev:playground
pnpm dev:agent
pnpm dev:extension
```

Useful Playground routes are `/audit-lab`, `/studio/appearance`, `/studio/motion`, `/studio/props`, and `/studio/library` on `http://localhost:3000`.

Load `apps/extension/.output/chrome-mv3` from `chrome://extensions`. After installing, reloading, or rebuilding the extension, reload it and refresh the target HTTP/HTTPS tab so the page receives the latest Content Scripts.

The root Agent script uses `apps/playground` as its project root. The standalone CLI accepts an explicit absolute root:

```bash
yk-pets-agent dev --root /absolute/path/to/project
```

Never place development tokens in documentation, commits, or example logs.

## 4. Recommended integration order

1. Start Playground.
2. Start the Local Agent.
3. Start the extension development build.
4. Load or reload the extension.
5. Refresh `/audit-lab`.
6. Connect the Side Panel with the local address and token printed by the Agent.
7. Verify audit, issue navigation, DOM preview, patch generation, explicit apply, checks, and rollback.

Playground alone is enough for Studio-only work. Recipe sync, the production extension renderer, and Side Panel workflows require a real browser extension session.

## 5. Common change locations

| Change | Primary location | Required concerns |
|---|---|---|
| Motion time, interpolation, keyframes, prop events | `packages/pet-core/src/motion/` | Domain tests, contracts, bilingual docs |
| Prop entities and anchors | `packages/pet-core/src/props/` | Prop tests, budgets, migration |
| Studio pages and state | `apps/playground/app/pages/studio/`, `stores/` | Routing, persistence, responsive UI, WebGL |
| Production Cloud Fox visuals | `ExtensionAlignedCloudFox.vue` and thin semantic components | Canonical renderer gate, visual cases, extension build |
| Extension messages and shared data | `packages/shared/src/` | Schemas, compatibility aliases, all consumers |
| Page audit and overlay | `apps/extension/entrypoints/content*` | Shadow DOM, host-page pollution, keyboard interaction |
| Network Lab | `apps/extension/features/network-lab/` | Domain-to-presentation flow |
| Local Agent | `packages/local-agent/src/` | Root confinement, hashes, command allowlist, Vitest |
| Stack or dependency changes | Workspace manifests and lockfile | Stack, architecture, development, and release docs |

## 6. Development constraints

- Change pure domains before application orchestration, platform adapters, and UI.
- Do not create a second production Cloud Fox topology or a second long-running TresCanvas.
- Keep appearance, motion, and prop assets independent.
- Domain code does not depend on Vue, Chrome APIs, the DOM, or the file system.
- Persistent formats require versions, normalization, and migration.
- User-facing copy is Chinese-first; engineering comments are bilingual.
- Review new extension permissions, production dependencies, public APIs, and destructive migrations before implementation.

## 7. Validation matrix

Documentation and comments:

```bash
pnpm check:documentation
pnpm check:brand
```

Domain and repository tests:

```bash
pnpm --filter @yk-pets/pet-core test
pnpm test
pnpm typecheck
```

Local Agent:

```bash
pnpm --filter @nova/local-agent test
pnpm --filter @nova/local-agent typecheck
pnpm build:agent
```

Extension and Playground:

```bash
pnpm build:extension
pnpm --filter @nova/playground typecheck
pnpm build:playground
```

Layout, interaction, WebGL, dragging, wheel input, keyboard behavior, audio, Side Panel, permissions, and local GLB require real-browser acceptance.

The complete delivery gate is:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm build:playground
```

## 8. Documentation and AI handoff

Feature changes under `apps/` or `packages/` must update `.ai/project-state.json` and at least one handoff context in the same feature batch. Chinese documentation uses Chinese filenames under `docs/zh-CN/`; English documentation remains under `docs/en/`.

Run `pnpm check:documentation` after link changes. The gate validates bilingual pairs, required sections, Chinese filenames, and repository-local Markdown links.

## 9. Build output

- Extension directory and ZIP: `apps/extension/.output/`;
- Local Agent: `packages/local-agent/dist/`;
- Nuxt: `apps/playground/.output/`.

Do not edit or commit generated output. See [build, package, and release](./BUILD-AND-RELEASE.md).

## 10. Troubleshooting order

Check worktree state and runtime versions; stale development processes, HMR caches, and extension reload state; the smallest failing workspace; root contract gates; browser Console, Service Worker, and Side Panel; broad CSS selectors and host-page pollution; then WebSocket address, token, Origin, and Agent root.

See [troubleshooting](./TROUBLESHOOTING.md) for detailed cases.

