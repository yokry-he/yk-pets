# Network Lab and Mock Workbench Operations

This guide focuses on interception, Mocking, response transformation, conflicts, and performance analysis. Start with the general [User Guide](./USER-GUIDE.md) when installing NOVA for the first time.

## 1. Execution scope

The current release hooks page-world `fetch` and `XMLHttpRequest`. Scripts, styles, images, fonts, and media are observed through Performance Resource Timing but their bodies are not modified.

Not currently covered: WebSocket frames, SSE streams, Service Worker-only requests, chunk-level streaming transforms, and browser-internal pages.

## 2. Master and capture switches

- The **master switch** controls Mocking, response modification, and delay.
- The **capture switch** controls request and resource performance records.

Keep capture enabled with the master disabled when analyzing real traffic. Turn the master off when a Mock session ends.

## 3. Full Mock execution order

```text
Page calls fetch/XHR
→ Load origin settings
→ Rank enabled rules
→ Match URL, method, query, and scope
→ Select a Mock rule
→ Wait for configured delay
→ Construct Response or simulated XHR completion
→ Record the Mocked request
→ Do not send a real network request
```

## 4. Mocking a nonexistent endpoint

A page may call `/api/future-feature`. Create a GET Glob rule for that path, configure a 200 JSON body, and enable it. The page receives the configured payload even when no backend endpoint exists.

## 5. Generate from a captured request

Captured response previews are sanitized and may be truncated. Before saving, verify array completeness, long strings, sensitive placeholders, content type, and status. Exact large-response replay belongs to a future recording/HAR workflow rather than the limited preview.

## 6. Test and conflicts

Provide a test URL and method. The test shows whether the candidate matches, which rule would win, competing rules, and the priority/specificity ordering. Resolve danger-level conflicts before enabling the rule.

## 7. Priority convention

| Scope | Suggested priority |
|---|---:|
| Site fallback | 10–30 |
| Module rule | 50–80 |
| Single endpoint | 100 |
| Temporary override | 150–200 |

Avoid enabling two rules with identical scope, pattern, method, query, and priority.

## 8. Response transformation

Use real-response transforms for feature flags, test permissions, removed internal fields, adjusted pagination totals, and malformed/empty-state tests. Do not use JSON transforms on binary, non-JSON, or streaming responses.

## 9. Timing interpretation

TTFB covers the wait for the first response byte. Download covers first byte to completion. Transfer size is the network payload size. Cross-origin resources may hide timing and size details unless the server exposes them. P95 highlights long-tail latency that averages can hide.

## 10. Isolate a performance bottleneck with Mocking

Record the real timing, replace a slow endpoint with a low-latency Mock, repeat the same page action, and compare. A large improvement points to network/server cost; little improvement points to parsing, state updates, DOM rendering, or data volume.

## 11. Safety checklist

Confirm the origin, keep patterns narrow, leave duplicates disabled, never save real tokens, sanitize exports, turn the master switch off after testing, and verify that release defaults remain disabled.

## v0.6.0 expandable requests and rule synchronization

### Expanding request details

Every row in the **Requests** tab now includes an **Expand details** action. The expanded row can display:

- Full URL and query parameters.
- Status, duration, size, and source.
- DNS, connection, TLS, TTFB, and download timing.
- Request and response headers.
- Request-body and response previews.
- Mock, response-modification, and error state.

Authorization, cookies, tokens, passwords, secrets, sessions, and credential-like values are redacted before they enter the Side Panel.

### Creating a rule from a request

Choose **Create rule from request** in an expanded row. The full-page editor is prefilled with the URL, method, status, and available response preview. Saving writes the rule to Chrome Storage and immediately synchronizes it to the current page interceptor.

### Creating a nonexistent endpoint

Open the **Rules** tab and choose **New rule**. Enter any relative path or full URL. After saving and enabling it, a matching Fetch/XHR call receives the Mock response without requiring a real server endpoint.
