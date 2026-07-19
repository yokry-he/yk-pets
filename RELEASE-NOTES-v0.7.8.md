# YK Pets v0.7.8 Release Notes

v0.7.8 adds the remote collaboration and pull-request release lifecycle layer while preserving the browser-extension stable baseline at 0.6.10.

## Added

- `@yk-pets/pet-github-provider`: fixed, repository-allowlisted GitHub command contract.
- `@yk-pets/pet-pr-lifecycle`: race-resistant PR/check/review synchronization and lifecycle diffs.
- `@yk-pets/pet-review-governance`: exact reply/resolve plans and explicit partial results.
- `@yk-pets/pet-merge-gate`: deterministic eligible/waiting/blocked decisions.
- `@yk-pets/pet-remote-release`: one-time approvals for retry, review, merge, and cleanup.
- Extension lazy feature `remote-collaboration` and command `collaboration:run`.
- Three integration examples and bilingual module guides.

## Security hardening

- All remote mutations bind repository, PR, exact Head SHA, lifecycle digest, action, and resource digest.
- Merge approvals bind the merge method.
- Cleanup approvals bind branch deletion, Worktree session, and force-cleanup scope.
- Required Check names that resolve to multiple current records block as ambiguous.
- Review plans bind the latest comment ID and never expose automatic review dismissal.
- Scope, publish, and remote approval token decoders reject non-canonical base64url encodings.

## Compatibility

- Platform and SDK version: 0.7.8.
- Browser extension stable baseline: 0.6.10.
- No existing package was removed.
