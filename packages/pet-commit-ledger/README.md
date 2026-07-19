# @yk-pets/pet-commit-ledger

Append-only `yk-pets.commit-record/v1` entries. Each entry includes the previous digest, exact base and commit revisions, branch, approved plan digest, gate digest, validation evidence digests, changed paths, optional push result, and optional draft pull-request metadata. The chain is verified before and after append, making deletion, reordering, or record mutation detectable.
