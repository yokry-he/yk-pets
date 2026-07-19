# Isolated Git Worktrees v0.7.7

`GitWorktreeCoordinator` manages opaque leased sessions. Opening a session verifies that the mutable base ref still resolves to the approved exact SHA, the branch does not exist, and the newly created worktree is clean and correctly attached. The state machine is `open → committed → pushed → closed`; expiry and failures trigger cleanup.
