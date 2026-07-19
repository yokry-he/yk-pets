# Controlled Repository Publishing v0.7.7

`RepositoryPublisher` consumes a one-time scope-bound approval, stages the exact approved paths, evaluates the real repository gate, commits, optionally pushes, optionally creates a draft PR, and always records post-commit partial failures in the ledger. `yk-pets.publish-approval/v1` binds the complete publication scope and is single-use with a maximum ten-minute lifetime.
