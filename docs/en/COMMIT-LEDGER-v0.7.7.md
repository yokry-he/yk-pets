# Tamper-evident Commit Ledger v0.7.7

`CommitLedger` appends `yk-pets.commit-record/v1` entries chained by the previous digest. Each entry binds plan, approval, base, branch, commit, gate, validation, paths, optional push, and optional draft PR. `verifyCommitLedger()` detects mutation, deletion, reordering, and forks. Production stores must provide compare-and-swap persistence.
