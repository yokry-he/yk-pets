# YK Pets v0.7.6

## Highlights

- Added deterministic, hash-bound source patch plans.
- Added HMAC-signed, one-time, narrowly scoped modification approvals.
- Added compare-and-swap file transactions with automatic reverse rollback.
- Added strict extension Background and CI workspace RPC adapters.
- Added approval → transaction → verification → rollback orchestration.
- Added lazy extension modification loading and a separate host authorization gate.

## Safety defaults

- Absolute paths, traversal, backslashes, `.git`, `.yk-pets/approvals`, and `node_modules` modifications are rejected.
- Updates, deletes, moves, and rollback require exact SHA-256 preconditions.
- Symlinks and directories are never followed or replaced.
- Approval tokens bind the exact plan digest and are one-time.
- Required verification without an adapter rolls back.
- Verification failure, exception, timeout, or abort rolls back.
- Rollback does not overwrite concurrent external changes.
- Workspace RPC has no shell, dynamic method, evaluation, or arbitrary script command.

## Release state

- Platform version: `0.7.6`
- SDK packages: 18
- Automated tests: 206
- Browser extension baseline: `0.6.10` unchanged
