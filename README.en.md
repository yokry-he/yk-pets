# YK Pets v0.7.8

A modular SDK for the YK Pets 3D browser pet, page Agent, and controlled development workflows. v0.7.8 adds remote pull-request synchronization, check governance, review-thread plans, deterministic merge eligibility, one-time remote approvals, and post-merge cleanup.

## New in v0.7.8

- `@yk-pets/pet-github-provider`: fixed, repository-allowlisted GitHub commands with no arbitrary REST, GraphQL, URL, script, or token surface.
- `@yk-pets/pet-pr-lifecycle`: race-resistant PR, check, review-thread, and review snapshots using before/after PR reads.
- `@yk-pets/pet-review-governance`: head-, snapshot-, and latest-comment-bound reply/resolve plans; no automatic review dismissal.
- `@yk-pets/pet-merge-gate`: deterministic gates for exact head, base, draft state, conflicts, freshness, required checks, approvals, and unresolved threads.
- `@yk-pets/pet-remote-release`: short-lived one-time approvals for failed-check retry, review plans, merge, and post-merge cleanup.
- `@yk-pets/pet-extension-runtime`: lazy `remote-collaboration` feature and fixed `collaboration:run` message.

All remote mutations are bound to repository, PR number, exact head SHA, lifecycle digest, action, and resource digest. Merge approvals additionally bind the merge method; cleanup approvals bind branch, worktree session, and force-cleanup scope. Tokens are single use.

Workspace version: `0.7.8`; packages: 28; target automated-test baseline: 337; browser-extension stable baseline: `0.6.10`.

```bash
npm install
npm run release:verify
```

See `examples/github-collaboration-host.ts`, `examples/controlled-pr-lifecycle.ts`, `examples/extension-collaboration.ts`, and the v0.7.8 guides under `docs/`.
