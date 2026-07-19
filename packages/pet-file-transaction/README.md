# @yk-pets/pet-file-transaction

Preflights a patch plan, reads every touched file before writing, enforces compare-and-swap hashes, applies primitive writes/deletes sequentially, records a sensitive rollback journal, and automatically reverses completed mutations after failure or abort. Rollback never overwrites concurrent external edits.
