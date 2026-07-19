# YK Pets v0.7.7 Release Notes

## Added

- Five repository publication packages: policy, worktree, ledger, local host, and publisher.
- Exact-SHA isolated worktree sessions with leases and deterministic cleanup.
- Fail-closed pre-commit policy for protected branches/paths, approved path sets, staged state, budgets, required validations, secret findings, and commit subjects.
- Real shell-free local Git adapter and content-hash workspace adapter.
- One-time HMAC publish approvals bound to the complete publication scope.
- Controlled commit, allowlisted push, forced draft pull-request adapter, and append-only commit record.
- Lazy extension feature `repository-publish` and fixed command `repository:publish`.

## Security

- Git is invoked with an executable plus an argument vector and `shell: false`.
- The child environment removes uncontrolled Git/SSH variables.
- Repository-local configuration capable of executing or redirecting code is rejected.
- Git hooks are bypassed with `--no-verify`; validations are explicit evidence rather than implicit scripts.
- Push requires an allowed remote name and exact normalized allowed remote URL.
- No arbitrary shell, dynamic Git subcommand, arbitrary JavaScript, or page-held repository credential is introduced.

## Validation

- 23 packages built.
- 270/270 automated tests passed.
- Real temporary Git repositories, isolated worktrees, commits, and pushes to a temporary bare remote were exercised.
- The GitHub draft-PR adapter was contract-tested through an injected invoker; no live GitHub PR was created.
- Browser-extension stable baseline remains 0.6.10.
