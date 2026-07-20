# NOVA Network Lab v0.5.0

## 1. Goal

v0.5.0 extends NOVA from page auditing and pet interaction into an in-browser network debugging workbench. It captures Fetch, XHR, and static resources; applies fixed Mock responses, JSON response transforms, and delay; provides a per-origin master switch; and analyzes slow requests and resources with charts.

Complex configuration stays in the Side Panel. The pet provides entry points, state feedback, and concise alerts.

## 2. Usage flow

1. Select Network Lab from the pet's Engineering mode.
2. Confirm the current origin at the top of the Side Panel.
3. Enable or disable interception and Mocking with the site master switch.
4. Refresh and inspect Fetch, XHR, and resource entries on Requests.
5. Open a request for status, timing, size, and response preview.
6. Generate a Mock or create a rule manually.
7. Save to synchronize the rule to the current page.
8. Review slowest requests, transfer-size distribution, waterfall, and diagnoses on Overview.

Turning the master switch off immediately stops Mocking, response transforms, and artificial delay while optional capture continues.

## 3. Architecture

```text
features/network-lab/
├── domain
├── application
├── infrastructure
└── presentation

entrypoints/
├── network-main.content.ts
└── network-bridge.content.ts
```

Domain contains pure matching and JSON-transform logic. Application services aggregate performance and orchestrate use cases. Repositories and page channels adapt Chrome Storage and runtime messaging. Vue components and composables form the presentation layer.

## 4. Patterns

- Strategy for Mock, modify-response, delay, Glob/regex matching, and set/remove transforms.
- Repository for site settings and rules.
- Adapter for main-world interception, isolated-world bridging, runtime messaging, and Chrome Storage.
- Application Service for summaries, P95, scoring, ranking, and diagnoses.
- Presentation/Composable separation so UI components do not call Chrome Storage directly.

## 5. Execution path

```text
Side Panel
→ Chrome Runtime message
→ Isolated bridge
→ window.postMessage configuration
→ Main-world Fetch/XHR interceptor
→ Real or Mock response
→ Entry event
→ Resource Timing merge
→ Side Panel charts and diagnoses
```

READY/configuration handshakes avoid document-start ordering races.

## 6. Safety and boundaries

Mocking is off by default. Previews are bounded and sensitive fields are sanitized. Rules and settings remain in local Chrome Storage. The current release does not upload network records.

Fetch/XHR bodies can be Mocked or transformed. Static resources are performance-only. WebSocket, SSE, Service Worker-internal traffic, streaming transforms, and deep CDP interception are outside this version.
