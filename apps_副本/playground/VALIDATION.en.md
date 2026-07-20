# Validation Report

Environment: Node.js 22.16.0.

## Baseline validation

The v1.0.1 baseline used for this upgrade had previously passed:

- `pnpm typecheck`
- `pnpm build`
- Production server startup
- `GET /` returned HTTP 200
- Local Mock Agent returned structured commands

## v1.2.0 motion-upgrade validation

Confirmed:

- The frontend `PetAnimation` union, XState events, and server Zod schema contain the same `jumping`, `flapping`, and `resting` states.
- The `speaking` prop is passed from `index.vue` through `PetCanvas.vue` to `CloudFox.vue`.
- The local Agent routes test phrases to the new animation commands.
- Explanatory Vue and template comments use the bilingual Chinese/English format.

## Current Monorepo validation

After the bilingual documentation and comment update, the following commands were run again:

```bash
pnpm typecheck
pnpm build:playground
```

Result: all passed.

The production build reports a warning for a Three.js/TresJS 3D chunk larger than 500 KB, but the build succeeds. The chunk is loaded through the asynchronous avatar component and does not affect the audit Content Script.
