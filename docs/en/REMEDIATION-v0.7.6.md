# Safe Remediation v0.7.6

`RemediationRunner` validates and previews the plan, consumes a one-time approval, applies the CAS transaction, runs optional required verification, and automatically rolls back on verification failure, exception, timeout, or cancellation. Recovery intentionally does not inherit an already-aborted user signal.
