# YK Pets Changelog

[简体中文](./CHANGELOG.md) · [English](./CHANGELOG.en.md) · [Project README](./README.en.md)

This document consolidates the Release Notes, Migration guides, Validation reports, and Merge Instructions that were previously stored as many separate files in the repository root. Future releases should update this document and its Chinese counterpart instead of creating multiple overlapping documents for every minor version.

## Current release baseline

| Item | Current value |
|---|---|
| Platform version | `0.7.8` |
| SDK packages | 28 |
| Automated tests | 337 / 337 |
| Aggregate exports | 28 / 28 |
| Node.js | `>= 22.0.0` |
| Stable browser-extension baseline | `0.6.10` |
| Offline-install audit | 0 vulnerabilities |

## Version evolution

| Version | Theme | SDKs | Tests |
|---|---|---:|---:|
| `0.7.3` | Platform governance: 2D fallback, agent permissions, plugin governance | 5 | 44 |
| `0.7.4` | Extension runtime: site policy, lifecycle, and lazy loading | 9 | 88 |
| `0.7.5` | DOM/Vue source mapping, CDP, and fix verification | 13 | 144 |
| `0.7.6` | Safe source modification, file transactions, and rollback | 18 | 206 |
| `0.7.7` | Isolated worktrees, controlled commits, pushes, and Draft PRs | 23 | 270 |
| `0.7.8` | PR lifecycle, review governance, and merge gates | 28 | 337 |

> The platform SDK version and browser-extension Manifest version evolve independently. The stable extension baseline remained `0.6.10` from `0.7.3` through `0.7.8`.

---

## v0.7.8 — Remote collaboration and release lifecycle

### Core capabilities

Five remote-collaboration SDKs were added:

- `@yk-pets/pet-github-provider`: fixed GitHub commands restricted to allowlisted repositories;
- `@yk-pets/pet-pr-lifecycle`: double-read snapshots for PRs, Checks, Reviews, and Review Threads, preventing mixed-state snapshots;
- `@yk-pets/pet-review-governance`: reply and resolve plans bound to the current head, snapshot, and latest comment;
- `@yk-pets/pet-merge-gate`: deterministic `eligible / waiting / blocked` merge decisions;
- `@yk-pets/pet-remote-release`: orchestration for check retry, review actions, merge, and post-merge cleanup.

The extension runtime gained the lazy `remote-collaboration` feature and the fixed `collaboration:run` message. The collaboration bundle is not loaded before authorization, and sites with auditing disabled are rejected before the authorization callback.

### Security hardening

- Remote mutations bind the repository, PR, exact head SHA, lifecycle digest, action, and resource digest;
- Merge approval additionally binds the selected merge method;
- Cleanup approval binds the remote branch, local worktree session, and force-cleanup scope;
- Multiple current checks with the same required name are treated as ambiguous and block merging;
- Review plans bind the latest comment ID and expose no automatic review dismissal;
- Scope, Publish, and Remote approval decoders reject non-canonical base64url;
- Remote branch deletion and local worktree cleanup are allowed only after the PR is confirmed merged.

### Migrating from v0.7.7

1. Upgrade all `@yk-pets/*` dependencies to `0.7.8`;
2. Create a trusted-host `GitHubProvider` with explicit `allowedRepositories`;
3. Map the GitHub SDK or connector to the fixed `GitHubProviderInvoker`; never pass arbitrary URLs, GraphQL, or tokens through it;
4. Use `PullRequestSynchronizer` to read PRs, Checks, Reviews, and Review Threads as one lifecycle snapshot;
5. Issue separate one-time approvals for check retry, review actions, merge, and cleanup;
6. Run `evaluateMergeGate` before merge and bind the gate digest to approval;
7. Configure `loadCollaborationFeature` and `authorizeCollaborationAction` in the extension runtime.

A new approval is required after changes to the head, PR snapshot, latest review comment, merge method, or cleanup scope.

### Validation

- All 28 SDKs built successfully;
- 337 / 337 automated tests passed;
- 28 / 28 aggregate exports were usable;
- Offline installation succeeded after extracting the final SDK archive;
- The npm installation audit reported zero vulnerabilities;
- The v0.7.7 → v0.7.8 patch changed 84 files: 43 added, 41 modified, and none deleted;
- `git diff --check`, `git apply --check`, actual patch application, and source-tree equivalence passed.

Remote collaboration was validated with an in-memory GitHub host and a strict command simulator. No production GitHub token or live PR was used.

---

## v0.7.7 — Real repositories and controlled commits

### Core capabilities

The release added:

- `@yk-pets/pet-repository-policy`;
- `@yk-pets/pet-git-worktree`;
- `@yk-pets/pet-commit-ledger`;
- `@yk-pets/pet-local-agent-host`;
- `@yk-pets/pet-repository-publisher`.

It introduced exact-baseline isolated worktrees, fail-closed pre-commit gates, one-time publish approvals, controlled commits and pushes, a forced-draft PR adapter, and a tamper-evident commit ledger. The extension gained the lazy `repository-publish` feature and fixed `repository:publish` message.

### Security hardening

- Git uses an executable plus argument array with `shell: false`;
- The child environment removes uncontrolled Git and SSH variables;
- Dangerous hooks, filters, credential helpers, SSH commands, and URL rewrites are rejected;
- Commits use `--no-verify`; validation is supplied through explicit `ValidationEvidence`;
- Push validates both the remote name and normalized URL;
- The actual changed path set must exactly equal the approved scope;
- Page contexts never receive workspace paths, HMAC keys, or GitHub credentials.

### Migrating from v0.7.6

1. Add the repository-policy, worktree, ledger, local-host, and publisher packages;
2. Run v0.7.6 file transactions inside an isolated worktree instead of modifying the primary working tree;
3. Configure protected branches and paths, allowed paths, file-count limits, and byte budgets;
4. Supply explicit test, build, and secret-scan evidence before commit;
5. Configure allowlists for both remote names and normalized remote URLs;
6. Issue a one-time Publish Approval for the complete publication scope;
7. Require the PR creator to force `draft: true`.

### Validation

- All 23 SDKs built successfully;
- 270 / 270 automated tests passed;
- Real temporary Git repositories exercised worktree creation, exact staging, commits, and pushes to a temporary bare remote;
- 23 / 23 aggregate exports and offline installation passed;
- The v0.7.6 → v0.7.7 patch changed 77 files: 43 added, 34 modified, and none deleted;
- Patch checks, actual application, and source-tree equivalence passed.

Draft PR integration was contract-tested through an injected adapter; no live GitHub PR was created.

---

## v0.7.6 — Safe modification and automatic rollback

### Core capabilities

The release added:

- `@yk-pets/pet-patch-plan`;
- `@yk-pets/pet-scope-approval`;
- `@yk-pets/pet-file-transaction`;
- `@yk-pets/pet-project-host`;
- `@yk-pets/pet-remediation-runner`.

It introduced deterministic hash-bound patch plans, one-time HMAC scope approvals, compare-and-swap file transactions, automatic rollback after failed verification, and strict Background / CI workspace RPC. The extension gained the lazy `safe-modification` feature and fixed `modification:run` message.

### Security hardening

- Absolute paths, traversal, backslashes, and protected directories are rejected;
- Updates, deletes, moves, and rollback depend on exact SHA-256 values;
- Symlinks are not followed and directories are not replaced as files;
- Approval binds the plan digest, user, project, origin, file set, operation types, and write budget;
- Approval is one-time;
- Partial transaction failure triggers reverse-order rollback;
- Rollback reports a conflict instead of overwriting a concurrent external edit;
- Missing adapters, failed verification, exceptions, timeouts, and cancellation all trigger rollback;
- Workspace RPC exposes no Shell, dynamic method, `Runtime.evaluate`, or arbitrary script execution.

### Migrating from v0.7.5

1. Replace unstructured modification instructions with `yk-pets.patch-plan/v1`;
2. Add previous-content SHA-256 values to every update, delete, and move;
3. Store HMAC keys in a trusted host and issue one-time Scope Approvals;
4. Apply modifications through `FileTransaction`, not direct file-system calls;
5. Use `RemediationRunner` to connect preview, approval, transaction, verification, and rollback;
6. Let Background and CI implement only the fixed `yk-pets.workspace-host/v1` RPC;
7. Keep page-audit authorization separate from source-modification authorization.

### Validation

- All 18 SDKs built successfully;
- 206 / 206 automated tests passed;
- 18 / 18 aggregate exports and offline installation passed;
- The v0.7.5 → v0.7.6 patch changed 102 files and deleted none;
- Actual patch application and source-tree equivalence passed.

Validation used in-memory file adapters, a strict RPC loopback, and simulated verification hosts. No production file or user repository was changed.

---

## v0.7.5 — Source mapping and deep analysis

### Core capabilities

The release added:

- `@yk-pets/pet-devtools-bridge`: an origin-bound, budgeted, timeout-aware, event-buffered, redacted read-only CDP bridge;
- `@yk-pets/pet-source-mapper`: stable DOM selectors, Vue 2/3 ownership, Inspector metadata, and Source Map v3 localization;
- `@yk-pets/pet-verification-runner`: adapter-driven Lighthouse and declarative Playwright verification;
- `@yk-pets/pet-change-report`: deterministic `yk-pets.change-report/v1` JSON and Markdown reports.

The extension gained the lazy `deep-analysis` feature and fixed `analysis:run` message.

### Security hardening

- `Runtime.evaluate`, `Runtime.callFunctionOn`, and arbitrary script execution are permanently denied;
- DOM writes, synthesized input, navigation, downloads, cookies, response bodies, and script injection are denied;
- CDP sessions bind one tab and one origin;
- Playwright accepts declarative safe steps only and exposes no `evaluate` step;
- Form input requires explicit `allowFormInput`;
- URL assertions cannot leave the target origin;
- Deep analysis loads only after an explicit request on a site where auditing is allowed.

### Migrating from v0.7.4

1. Wrap `chrome.debugger` inside the extension Background or Service Worker;
2. Let the Content Script collect only stable selectors, Vue ownership, and Inspector metadata;
3. Read Source Maps from trusted build output or a trusted development server and register them explicitly;
4. Implement Lighthouse and Playwright through trusted adapters;
5. Execute only declarative `SafePlaywrightScenario` steps;
6. Use change reports to connect findings, source candidates, modifications, verification, and rollback;
7. Lazy-load `deep-analysis` from the extension runtime.

### Validation

- All 13 SDKs built successfully;
- 144 / 144 automated tests passed, including 56 new tests;
- 13 / 13 aggregate exports and offline installation passed;
- The v0.7.4 → v0.7.5 patch check, actual application, and source-tree equivalence passed.

Validation covered adapter contracts and simulated host data flows; it did not claim to run Lighthouse or Playwright against a live site.

---

## v0.7.4 — Browser-extension runtime integration

### Core capabilities

The release added:

- `@yk-pets/pet-site-policy`;
- `@yk-pets/pet-runtime-lifecycle`;
- `@yk-pets/pet-feature-loader`;
- `@yk-pets/pet-extension-runtime`.

It implemented per-site enable, pause, hide, and `auto / 2d / 3d` behavior; suspension for hidden, offscreen, frozen, and `pagehide` states; lazy 3D and audit loading; and a fixed extension runtime message protocol.

### Behavioral guarantees

- Hidden sites initialize neither 2D nor 3D;
- Paused sites mount a stopped 2D renderer and never load 3D;
- A failed 3D bundle remains contained by the 2D fallback and does not immediately loop;
- Concurrent feature requests execute one loader;
- A timeout rejects even if the loader ignores Abort;
- The audit collector loads only on the first audit request;
- Site policy is re-resolved after SPA navigation.

### Migrating from v0.7.3

1. Persist site policy through a `chrome.storage.local` adapter;
2. Keep the Canvas 2D factory as the immediately available lightweight renderer;
3. Move the Three.js / TresJS factory out of the main Content Script bundle and load it dynamically;
4. Move page auditing out of the main bundle and load it only on request;
5. Create `ExtensionPetRuntime` in the Content Script and attach browser lifecycle events;
6. Map Side Panel controls to `enabled / paused / hidden`;
7. Replace arbitrary runtime method forwarding with fixed messages.

### Validation

- All 9 SDKs built successfully;
- 88 / 88 automated tests passed;
- 9 / 9 aggregate exports and offline installation passed;
- Initial testing found and fixed wildcard site matching, duplicate feature loading, retained resources after disabling, and immediate repeated 3D loading after failure.

---

## v0.7.3 — Platform-governance foundation

### Core capabilities

The release added:

- automatic 2D fallback and recovery for WebGL and low-performance conditions;
- a procedural Canvas 2D cloud fox;
- agent-tool capability declarations, permissions, confirmations, and audit records;
- standard capability declarations for five local-agent tools;
- the `yk-pets.plugin/v1` plugin manifest;
- semantic-version compatibility, dependency, capability-conflict, and lifecycle governance;
- an aggregate platform export package.

### Safety and stability

- Failed 3D creation switches immediately to 2D without a queue deadlock;
- Failed 3D recovery keeps the healthy 2D renderer;
- Tool permissions use deny-first merging;
- Confirmation tokens are one-time and usage-limited;
- Tool execution enforces timeouts and records audit events;
- Plugin wildcard permissions cannot expand the host allowlist;
- Exclusive capability conflicts are rejected, and providers activate before consumers.

### Migrating from v0.7.2

1. Add the five governance-layer packages;
2. Create a 2D factory with `createCanvas2DRendererFactory()`;
3. Adapt the existing Three renderer to `{ kind: '3d', create() }`;
4. Instantiate `AdaptiveRendererController` in the host;
5. Feed runtime probes through `BrowserRuntimeMonitor`;
6. Register local-agent tools in `ToolCatalog` and execute them through `GovernedToolExecutor`;
7. Require third-party plugins to provide `yk-pets.plugin/v1` and activate through `PluginRegistry`.

### Validation

- All 5 newly added SDKs built successfully;
- 44 / 44 automated tests passed;
- 5 / 5 key aggregate exports passed;
- Offline installation into a fresh temporary project passed;
- The npm installation audit reported zero vulnerabilities.

This stage validated an independently mergeable governance increment. Real browser WebGL, low-battery hardware, and final visual switching still required acceptance testing in the target extension.

---

## General upgrade principles

When upgrading across versions:

1. Keep all `@yk-pets/*` packages on the same platform version;
2. Run `npm ci`, followed by `npm run validate`;
3. Run `npm run release:verify` when package output changes;
4. Keep the Canvas 2D renderer as the safe fallback for 3D failures;
5. Authorize page auditing, source modification, repository publishing, and remote collaboration independently;
6. Keep HMAC keys, GitHub tokens, Git credentials, and file handles inside trusted hosts;
7. Regenerate plans and approvals after any change to the head, lifecycle snapshot, file hash, patch scope, or approval scope;
8. Add integration acceptance in the target environment for real browsers, real projects, and remote services.

## Historical validation note

Across releases, validation covered builds, declarations, Source Maps, automated tests, npm tarballs, offline installation, aggregate exports, installation audits, and incremental patch equivalence. Browser, Lighthouse, Playwright, real file-system, Git, and GitHub capabilities count as genuine execution only when a release entry explicitly records a real temporary or live environment; otherwise, the validated scope is the strict adapter contract and simulated host data flow.
