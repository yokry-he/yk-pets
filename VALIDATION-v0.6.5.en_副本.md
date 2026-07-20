# NOVA Browser Agent v0.6.5 Validation Report

## Focused scenario

- Current page: `http://localhost:5188`.
- Rule: `GET /api/auth/profile`, scoped to the current page.
- The relative Fetch URL resolves to `http://localhost:5188/api/auth/profile` and matches the Mock.
- A cross-origin API target still matches when requested by the authorized page.
- A different page origin cannot match the rule accidentally.

## Checks

- Network-domain regressions cover relative URLs, ports, page scope, and cross-origin targets.
- The full Fetch Mock branch runs before the native Fetch call.
- Both Fetch and XHR provide the current page origin.
- Page configuration acknowledgement reaches the bridge snapshot and Network Lab UI.
- v0.6.5 Fetch Mock checks: 10/10.
- Network Domain: 19 assertions pass; Network Workbench: 18 assertions pass.
- Extension, Shared, Local Agent, and Playground type checks pass.
- Local Agent: two tests pass.
- Extension and Local Agent production builds pass.

## Artifact confirmation

- Chrome Manifest version: `0.6.5`.
- Side Panel footer version: `NOVA 0.6.5`.
- Extension output is about 1.27 MB; the ZIP is about 370 KB.
- The built main-world script contains relative URL resolution, page-origin matching, Mock short-circuiting, and the `CONFIGURED` acknowledgement.

## Post-install confirmation

Reload v0.6.5 in `chrome://extensions`, refresh the target page, and reopen the Side Panel. Confirm the footer says `NOVA 0.6.5` and Network Lab says one rule is synchronized before triggering the endpoint again.
