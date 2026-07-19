# Patch Plans v0.7.6

`@yk-pets/pet-patch-plan` describes changes but never accesses a workspace. Paths are project-relative, traversal and protected prefixes are rejected, update/delete/move operations require SHA-256 preconditions, text edits are sorted and non-overlapping, and the full canonical plan receives a SHA-256 digest used by approval tokens.
