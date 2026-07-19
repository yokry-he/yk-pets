# Repository Commit Gate v0.7.7

`@yk-pets/pet-repository-policy` emits a `yk-pets.repository-gate/v1` decision from the real Git snapshot, exact approved paths, exact base SHA, commit subject, validation evidence, and secret findings. Defaults are fail-closed: protected branches and paths are rejected, all changes must be staged, and actual paths cannot exceed the approved set. Hash the full decision with `computeCommitGateDigest()` and store it in the commit ledger.
