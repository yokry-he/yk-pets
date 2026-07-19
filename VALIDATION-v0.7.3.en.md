# YK Pets v0.7.3 Validation Report

Validation date: 2026-07-19  
Delivery type: additive platform-governance source for v0.7.2  
Stable browser-extension baseline: `0.6.10` (unchanged)

## 1. Environment

- Node.js: `v22.16.0`
- npm: `10.9.2`
- TypeScript: `5.8.3`
- Module format: ESM / NodeNext
- New workspace packages: 5

## 2. Full release gate

Command:

```bash
npm run release:verify
```

Result: passed. The command cleans generated output, builds all packages and declarations, runs tests and release checks, creates five npm tarballs, installs them offline in a clean temporary project, resolves the umbrella exports, and checks the install audit.

## 3. Automated tests

Result: `44/44` passed.

Coverage includes adaptive WebGL fallback and recovery, runtime voting and cooldowns, state migration, non-deadlocking renderer failure recovery, the asset-free Canvas 2D cloud fox, tool declarations and deny-overrides policy, one-time confirmations, enforced execution timeouts, audit records, plugin manifests, semantic compatibility, dependency cycles, capability ordering, exclusive conflicts, and wildcard-permission escalation prevention.

## 4. Build and package validation

- All five packages emit ESM, declarations, source maps, and declaration maps.
- The build contains 20 generated files.
- Five npm tarballs total approximately 39 KB.
- Tarballs contain only `dist`, `package.json`, and `README.md`.
- Offline installation into a clean project succeeded.
- Umbrella export smoke test: `5/5`.
- npm install audit: `0 vulnerabilities`.

Validated umbrella exports:

```text
AdaptiveRendererController
BrowserRuntimeMonitor
Canvas2DPetRenderer
GovernedToolExecutor
PluginRegistry
```

## 5. Version and compatibility gates

- The root delta and all five packages use `0.7.3`.
- The `yk-pets.plugin/v1` example parses as JSON.
- All three topic documents have Chinese and English versions.
- The stable extension remains `0.6.10`; no extension version `0.6.11` or later is declared.
- The eleven existing v0.7.2 SDK packages do not require version changes.

## 6. Boundary

The temporary v0.7.2 source tree from the previous conversation was not available in the current runtime, and the connected GitHub account exposed no repository. This delivery is therefore a fully validated additive delta rather than a commit already applied to the original monorepo.

After merging the new directories and scripts, the existing Three renderer must be adapted to `PetRendererFactory`. A final manual pass should still validate real WebGL context loss, low-power devices, and visual renderer switching inside the target browser-extension host.
