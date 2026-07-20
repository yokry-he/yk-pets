# NOVA v0.6.5: Fetch Mock Interception Fix

## Problem

After copying `GET /api/auth/profile` into a Mock rule, the rule could remain at zero hits and the page could still call the real endpoint even though interception was enabled for the current site.

When the page called `fetch('/api/auth/profile')`, the interceptor incorrectly resolved the relative URL against the fallback `http://localhost/`, losing the page's `5188` port. The rule's site scope was also compared with the API server origin instead of the origin of the page making the request.

## Fix

- Relative Fetch URLs are resolved against `location.href`, preserving protocol, host, and port.
- Fetch and XHR matching explicitly include the current `location.origin`.
- `scopeOrigin` identifies the page where a rule is authorized to run; the API target may be same-origin or cross-origin.
- A full Mock returns its synthetic response before the native Fetch function can run.
- The page main world now acknowledges applied configuration with `CONFIGURED`, and Network Lab displays “interceptor synced N rules.”

## Verification

Reload the extension and refresh the target page, then enable interception. The status should report that one rule is synchronized. Trigger `/api/auth/profile` again; the hit count should increase and the request detail should be marked as Mocked.

Requests that already completed cannot be replaced retroactively. Trigger the endpoint again after creating or enabling a rule.
