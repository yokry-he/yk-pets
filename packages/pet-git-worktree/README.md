# @yk-pets/pet-git-worktree

Creates opaque, expiring, isolated Git worktree sessions through a fixed adapter. Base refs are resolved and compared with the approved revision before creation. A new branch must not already exist. The new worktree must be clean, attached to the requested branch, and still point to the approved base revision. Only normalized project paths can be staged, and commit/push operations are bound to expected revisions.
