# @yk-pets/pet-repository-publisher

A controlled publish pipeline. A one-time HMAC approval is bound to the exact project, repository, session, plan digest, base revision, branch, commit subject, actions, remote, and pull-request base. The publisher stages only approved paths, re-reads the repository status, evaluates the repository gate, creates a parent-bound commit, optionally pushes an allowlisted remote, optionally creates a draft pull request through a fixed adapter, and appends a tamper-evident ledger record.

Failures before commit create no commit. Failures after commit are returned as a partial result and are still recorded in the ledger rather than hiding an existing local commit or remote push.
