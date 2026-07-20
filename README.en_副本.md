# NOVA Browser Agent

A 3D AI frontend engineer that lives in the bottom-right corner of the page. Animal interactions can audit any HTTP/HTTPS page, navigate and locate findings, preview improvements, and use a local WebSocket Agent to generate safety-constrained source diffs. Changes are written, verified, or rolled back only after explicit user confirmation.

## Repository layout

```text
apps/extension       Chrome/Edge Manifest V3 extension
apps/playground      Nuxt 3D cloud-fox demo and audit lab
packages/shared      Audit models and communication protocol
packages/local-agent Local-project WebSocket Agent
docs/                Product, architecture, security, protocol, and development documentation
```


## First use and release

- [Detailed User Guide](docs/en/USER-GUIDE.md)
- [Network Lab and Mock Workbench Operations](docs/en/NETWORK-LAB-OPERATIONS.md)
- [Build, Package, and Chrome Web Store Release](docs/en/BUILD-AND-RELEASE.md)
- [Troubleshooting](docs/en/TROUBLESHOOTING.md)
- [Code comments and maintenance](docs/en/DEVELOPER-MAINTENANCE.md)

## Quick start

```bash
corepack enable
pnpm install
```

Start the three services separately:

```bash
pnpm dev:playground
pnpm dev:agent
pnpm dev:extension
```

Load the following directory from the Chrome Extensions page:

```text
apps/extension/.output/chrome-mv3
```

Recommended test page:

```text
http://localhost:3000/audit-lab
```

## Implemented capabilities

- Vue 3 + WXT Manifest V3 extension with a persistent Side Panel
- Per-origin one-click Network Lab master switch
- Fetch/XHR full Mocking for existing or nonexistent endpoints
- Full-page Side Panel rule workbench for create, generate-from-request, edit, duplicate, test, conflict detection, and draft recovery
- Glob, regular-expression, method, and query matching
- JSON/text Mock responses, status and delay simulation, and real JSON response transforms
- Fetch/XHR/static-resource performance capture, request details, P95, scoring, slowest-request chart, transfer-size chart, and waterfall
- Domain/Application/Infrastructure/Presentation layering with Factory, Strategy, Repository, Adapter, and Application Service patterns
- Procedural TresJS cloud-fox pet, radial menus, brighter tail tip, dual antennae, gaze tracking, lifestyle motions, curated high-altitude fireworks, and random easter eggs
- Page audit, issue navigation, reversible DOM preview, source patch generation, explicit write confirmation, validation, and rollback
- Token-authenticated local WebSocket Agent with SHA-256 concurrent-edit protection and command allowlists

## Documentation

- [Product and interaction design](docs/DESIGN.md)
- [In-page 3D NOVA interaction design](docs/PET-INTERACTION.md)
- [Nebula transparency and radial menu](docs/en/NEBULA-RADIAL-MENU.md)
- [Cloud fox tail design](docs/en/TAIL-DESIGN.md)
- [Motion controls and idle carousel](docs/en/MOTION-CONTROLS.md)
- [On-demand notices and motion runtime](docs/en/NOTICES-AND-MOTION-RUNTIME.md)
- [Technical architecture](docs/ARCHITECTURE.md)
- [Local Agent protocol](docs/LOCAL-AGENT-PROTOCOL.md)
- [Security design](docs/SECURITY.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Roadmap](docs/ROADMAP.md)
- [Bilingual documentation and maintainability v0.5.2](docs/en/DOCUMENTATION-AND-COMMENTS-v0.5.2.md)
- [Pet vitality, fireworks, and easter eggs v0.6.0](docs/en/PET-VITALITY-FIREWORKS-v0.6.0.md)

- [Motion queue, active glow, and side-lying cloud nap v0.6.1](docs/en/ANIMATION-GLOW-SLEEP-v0.6.1.md)
- [Rule creation, motion audio, and thought bubbles v0.6.3](docs/en/MOTION-FEEDBACK-v0.6.3.md)
- [Nested rule-editor proxy fix v0.6.4](docs/en/RULE-PROXY-FIX-v0.6.4.md)
- [Fetch Mock interception fix v0.6.5](docs/en/FETCH-MOCK-INTERCEPTION-v0.6.5.md)
- [Whole-JSON real response editing v0.6.6](docs/en/WHOLE-JSON-RESPONSE-v0.6.6.md)
- [Audit scope, network categories, and pet feedback fixes v0.6.7](docs/en/AUDIT-NETWORK-PET-FEEDBACK-v0.6.7.md)
- [Audit child rules, tail-tip, and motion-speech fixes v0.6.8](docs/en/AUDIT-PET-AUDIO-v0.6.8.md)
- [Silent motion-speech asset fix v0.6.9](docs/en/MOTION-VOICE-AUDIO-v0.6.9.md)
- [Switchable pet voices and system cute-voice presets v0.6.10](docs/en/PET-VOICE-PRESETS-v0.6.10.md)
