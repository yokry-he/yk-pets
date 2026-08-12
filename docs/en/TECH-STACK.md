# YK-PETS Technology Stack

## 1. Purpose

This document describes the languages, runtimes, frameworks, core dependencies, build tools, and validation layers used by the current YK-PETS codebase. Package manifests and the root lockfile remain the source of truth for exact versions; this guide explains why each technology exists and where its responsibility ends.

## 2. Runtime and engineering baseline

| Technology | Baseline | Purpose | Constraint |
|---|---:|---|---|
| Node.js | 22+ | Local Agent, Nuxt server, builds, and validation scripts | Older runtimes are unsupported |
| pnpm | 11.13.1 | Monorepo installation, Workspace linking, and script orchestration | Use Corepack and `pnpm-lock.yaml`; do not mix package managers |
| TypeScript | 5.9.3 | Static typing for apps, domains, configuration, and scripts | `strict` and `noUncheckedIndexedAccess` are enabled |
| ECMAScript Modules | `type: module` | Repository-wide module format | New code uses `import`/`export` without a parallel CommonJS implementation |

The root `tsconfig.base.json` standardizes ES2022, Bundler module resolution, and strict type checking. Each workspace adds only the environment types and source ranges it needs.

## 3. Monorepo and package boundaries

```text
apps/extension             WXT browser extension and in-page pet runtime
apps/playground            Nuxt Playground and four-workspace Pet Studio
packages/shared            Cross-extension/Agent protocols, audit, network, and memory models
packages/local-agent       Local WebSocket Agent and constrained source patches
packages/pet-core          Framework-neutral pet, recipe, motion, and prop domains
packages/pet-vue-adapter   Vue 3 rendering adapter
packages/pet-web-component <yk-pet> Custom Element shell
scripts                    Architecture contracts, documentation gates, and focused regressions
```

Applications and adapters depend on domain packages; domains do not depend on UI or platform APIs. `pet-core` must not depend on Vue, Nuxt, Chrome APIs, the DOM, or the file system. `shared` defines cross-runtime data contracts rather than page state or rendering details.

## 4. Frontend application stack

### Vue 3

The extension and Playground use the Vue 3 Composition API for component composition, reactive UI state, and lifecycle integration. Independently testable motion evaluation, asset normalization, and network-rule matching stay outside Vue components.

### Nuxt 4

`apps/playground` uses Nuxt `4.4.8` for file-based routing, layouts, server APIs, runtime configuration, and the development server. The primary routes are `/audit-lab` and the `/studio/appearance`, `/studio/motion`, `/studio/props`, and `/studio/library` workspaces.

The OpenAI API key is read only from private server runtime configuration. Without a key, the pet command endpoint uses deterministic local fallback behavior.

### WXT and Manifest V3

`apps/extension` uses WXT `0.20.27` and `@wxt-dev/module-vue` to build the Chrome/Edge Manifest V3 extension. WXT owns the Background Service Worker, Content Scripts, Side Panel, static assets, manifest, and release archive.

Extension permissions are centralized in `apps/extension/wxt.config.ts`. New permissions require least-privilege review and synchronized security and release documentation. Durable state must not exist only in Service Worker memory because Manifest V3 may suspend and restart it.

### Pinia, XState, VueUse, and GSAP

| Dependency | Primary responsibility | Boundary |
|---|---|---|
| Pinia 4 | Playground appearance, Studio session, motion, and prop assets | Local UI/session state, not domain normalization |
| XState 5 | Playground pet state machine and event transitions | Not long-term user storage |
| VueUse 14 | Reusable browser-reactivity composables | Reuse established patterns instead of duplicating utilities |
| GSAP 3 | Time-based visual animation in the Playground | Not the motion-asset evaluator |

## 5. 3D rendering stack

Three.js `0.185.1` supplies geometry, materials, textures, cameras, lighting, and WebGL abstractions. TresJS `5.8.3` maps the Three.js scene to a Vue component tree.

`ExtensionAlignedCloudFox.vue` is the sole production Cloud Fox composition, and `CloudFoxStudioCanvas.vue` is the canonical preview. The extension reuses that renderer through a WXT alias. Do not create a second maintained pet topology or a second long-running TresCanvas for props, onion skins, or visual guides.

The motion consumption path is:

```text
StudioMotionAssetV2
  -> normalizeMotionAsset
  -> resolveMotionTime
  -> evaluateNormalizedMotionAsset
  -> EvaluatedCloudFoxPose
  -> CloudFoxStudioCanvas
  -> ProceduralPet
  -> ExtensionAlignedCloudFox
```

Motion poses store semantic offsets relative to the base appearance anchors; they do not mutate the appearance recipe.

## 6. Domain modeling and validation

`@yk-pets/pet-core` owns species definitions, recipe envelopes, renderer registration, the `cloud-fox-semantic-rig/v1`, millisecond motion time, FPS display grids, deterministic interpolation and evaluation, keyframe authoring, whole-clip correction layers, prop entities and events, motion layers, IK, audio cues, and safe local GLB validation.

`@nova/shared` retains its legacy Workspace name for `v0.6.10` compatibility but contains YK-PETS contracts. Zod `4.4.3` validates WebSocket messages, structured server output, and external input. Page data, Local Storage, imported JSON, WebSocket payloads, and model output are all untrusted until validated or normalized.

## 7. Local Agent and source safety

The Local Agent uses Node.js, `ws`, Commander, fast-glob, and `diff`:

- Commander defines the `yk-pets-agent` CLI;
- `ws` exposes a token-authenticated server bound to `127.0.0.1`;
- fast-glob locates constrained source candidates;
- `diff` produces a reviewable unified diff;
- tsup builds Node 22 ESM output;
- Vitest verifies patch behavior.

Patch application and rollback use SHA-256 concurrent-edit checks and backups. Paths must remain inside the explicit project root. The Agent may run only the predefined `typecheck`, `test`, and `build` scripts; it does not accept arbitrary shell commands.

## 8. OpenAI integration

The Playground server uses OpenAI JavaScript SDK `6.47.0` with the Responses API. Zod Structured Outputs constrain natural-language requests to known emotions, animations, and safe actions.

This integration powers the demo chat endpoint and is separate from the Local Agent's deterministic patch generator. Core Studio and extension functionality starts without a remote model; missing credentials or request failures fall back to local rules.

## 9. Build and validation tools

| Tool | Responsibility |
|---|---|
| vue-tsc / tsc | Vue and plain TypeScript type checking |
| WXT | Extension development, production build, and ZIP packaging |
| Nuxt CLI | Playground development, type checking, build, and generation |
| tsup | Local Agent ESM and declaration output |
| Node Test Runner | Framework-neutral `pet-core` domain tests |
| Vitest | Local Agent unit tests |
| Custom Node scripts | Architecture contracts, brand and bilingual documentation gates, motion checks, and numeric visual regressions |

Repository-level validation:

```bash
pnpm check:documentation
pnpm typecheck
pnpm test
pnpm build
pnpm build:playground
```

Static contracts and numeric tests do not replace real browser acceptance. Layout, interaction, WebGL, audio, Side Panel, and permission changes require validation in a real Chrome session.

## 10. Dependency-change policy

- Prefer existing dependencies and domain capabilities.
- Review maintenance, licensing, security history, bundle size, and runtime cost before adding production dependencies.
- Do not add a heavy package for a small utility.
- Keep a single Three.js instance per page.
- Keep framework adapters thin and move reusable behavior into `pet-core`.
- Update this guide, the development guide, architecture documentation, and project instructions when the stack or core commands change.

## 11. Related documentation

- [Technical architecture](./ARCHITECTURE.md)
- [Development and runtime guide](./DEVELOPMENT.md)
- [Security design and threat model](./SECURITY.md)
- [Developer maintenance guide](./DEVELOPER-MAINTENANCE.md)
- [Current project status](./PROJECT-STATUS.md)
