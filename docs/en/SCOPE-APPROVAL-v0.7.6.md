# Scope Approval v0.7.6

Approvals are HMAC-SHA256 signed and one-time. They bind the subject, project, exact plan digest, issue/expiry time, allowed operations, exact file or directory scopes, maximum files and write bytes, optional origin, and optional base revision. Keep the signing secret only in a trusted Background, desktop host, or CI secret store.
