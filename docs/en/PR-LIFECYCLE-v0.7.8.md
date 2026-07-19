# PR Lifecycle Synchronization v0.7.8

The synchronizer reads the PR before and after dependent resources. Any head, base, state, draft, mergeability, or update-time drift invalidates the collection. Snapshot storage uses digest compare-and-swap.
