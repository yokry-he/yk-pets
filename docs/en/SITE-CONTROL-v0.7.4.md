# v0.7.4 Per-site controls

A resolved policy contains the pet mode, renderer preference, audio, interactions, and audit switches. Rules are merged from defaults through increasingly specific matches, priority, and finally an expiring session override.

Supported patterns include `<all_urls>`, wildcard hosts, scheme/host/path match patterns, exact origins, and non-default ports. Use `createChromeStorageAdapter(chrome.storage.local)` to persist the `yk-pets.site-policy/v1` snapshot.

`hidden` controls pet visibility and renderer initialization. `auditEnabled` is independent, so a Side Panel audit may remain available while the pet is hidden.
