# @yk-pets/pet-local-agent-host

A real Node.js local repository host with two safety boundaries:

1. `LocalGitRepositoryAdapter` invokes only the fixed `git` executable with validated argument arrays and `shell: false`. It supports repository inspection, exact revision resolution, isolated worktree creation/removal, porcelain status parsing, exact-path staging, parent-bound commit, and allowlisted remote push.
2. `yk-pets.repository-host/v1` exposes those operations over a strict RPC envelope with per-request authorization. Unknown commands, malformed refs, path traversal, project mismatches, oversized output, timeouts, and aborts fail closed.

The host also creates a symlink-rejecting `WorkspaceAdapter` for each opaque worktree ID, allowing the v0.7.6 file transaction engine to modify a real isolated Git worktree without exposing arbitrary filesystem paths.
