# Troubleshooting

## 1. The pet does not appear

Confirm the page is a normal HTTP/HTTPS page. Chrome internal pages, the Web Store, and some new-tab pages cannot be injected. Inspect extension errors, reload the extension, and refresh the target tab.

## 2. The Side Panel cannot connect

Refresh tabs that were open before the extension was loaded or reloaded. Confirm host access, reopen the Side Panel, and inspect the extension service-worker log.

## 3. Mocking is enabled but does not apply

Check the displayed origin, site master switch, rule switch, method, URL pattern, query conditions, higher-priority conflicts, request transport, and page refresh after extension reload. Use the rule test area.

## 4. A nonexistent endpoint still reaches the network

The full Mock rule did not win. Verify that the action is Mock rather than Modify Response or Delay, and confirm the selected rule in the test result.

## 5. Response transforms do not change data

Confirm the response is JSON, the path and array indexes are correct, no higher-priority Mock overrides the rule, and the application is not applying another transformation afterward.

## 6. Timing values are zero

Cross-origin servers may not expose detailed resource timing without Timing-Allow-Origin. Cache and browser privacy behavior can also hide values.

## 7. Charts are empty

Enable capture, refresh the page, clear filters, and refresh again after an extension reload.

## 8. Local Agent connection fails

Check the process, WebSocket address, current token, localhost CSP, port conflicts, and endpoint-security software.

## 9. Build failures

Prune/reinstall the pnpm store when dependency resolution fails. Delete `.wxt/.output`, run extension prepare, typecheck, and rebuild when generated types or stale output are involved.

## 10. Chrome Web Store upload fails

Increase the Manifest version, ensure `manifest.json` is at the ZIP root, remove illegal files and remote executable code, and complete permission/privacy declarations in the Dashboard.
