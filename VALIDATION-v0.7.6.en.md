# YK Pets v0.7.6 Validation Report

- Validation date: 2026-07-19
- Platform version: `0.7.6`
- Browser extension stable baseline: `0.6.10` unchanged
- SDK packages: 18

## Result

The v0.7.6 safe modification and rollback layer passed clean builds, automated tests, release safety checks, npm package creation, offline installation into a fresh temporary project, and umbrella export smoke tests.

| Check | Result |
|---|---:|
| TypeScript package builds | 18/18 passed |
| Automated tests | 206/206 passed |
| Release safety assertions | Passed |
| npm SDK packages | 18/18 passed |
| Umbrella exports | 18/18 passed |
| Fresh offline installation | Passed |
| Installation audit | 0 vulnerabilities |
| Extension baseline gate | Remains 0.6.10 |
| v0.7.5 → v0.7.6 Git Patch | 102 changed files, 0 deleted files |
| `git apply --check` | Passed |
| Post-apply source tree equivalence | Passed |

## Validated capabilities

- Deterministic `yk-pets.patch-plan/v1` plans with SHA-256 preconditions and protected-path rules.
- HMAC-signed, one-time `yk-pets.scope-approval/v1` tokens bound to the exact user, project, origin, revision, paths, operations and byte budget.
- Compare-and-swap file transactions with reverse rollback and concurrent-change conflict protection.
- Strict `yk-pets.workspace-host/v1` Background/CI RPC without shell, dynamic dispatch, arbitrary evaluation or script execution.
- Approval, transaction, verification and fail-closed rollback orchestration.
- Lazy extension loading through `safe-modification` and an independent `authorizeModification` gate.

## Validation boundary

Tests used SDK automation, in-memory file adapters, strict loopback RPC adapters and simulated verification hosts. No real user repository, installed extension instance, Chrome debugging permission or CI credential was available, so this report does not claim real repository commits, branch pushes, production file writes, or live Lighthouse/Playwright runs.
