# YK Pets v0.7.4 Release Notes

## Theme

Extension runtime integration and performance isolation.

## Added

- `@yk-pets/pet-site-policy`
- `@yk-pets/pet-runtime-lifecycle`
- `@yk-pets/pet-feature-loader`
- `@yk-pets/pet-extension-runtime`
- Renderer `start`, `stop`, and `setVisible` lifecycle hooks
- Per-origin persistent rules and expiring session overrides
- Background, frozen-page, pagehide, and offscreen suspension
- Lazy 3D renderer and lazy audit collector loading
- Structured extension runtime command validation

## Behavior guarantees

- A hidden site does not initialize 2D or 3D.
- A paused site does not load 3D.
- A failed 3D module remains contained by the 2D fallback.
- Concurrent dynamic feature requests execute one loader.
- Feature timeouts reject even when the loader ignores the abort signal.
- Audit collection does not load until it is requested.
- The browser extension stable version remains `0.6.10`.

## Validation

- 9 SDK packages
- 88 automated tests
- clean TypeScript build
- offline package installation smoke test
- 9/9 umbrella export verification
