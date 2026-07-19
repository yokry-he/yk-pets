# File Transactions and Rollback v0.7.6

The executor preflights every touched path, rejects directories and symlinks, verifies revision and SHA-256 preconditions, applies CAS writes/deletes sequentially, and records a sensitive journal. Any partial failure is reversed in journal order. Rollback also uses CAS and reports conflicts instead of overwriting external changes.
