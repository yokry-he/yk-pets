# NOVA Browser Agent

A 3D AI frontend engineer that lives in the bottom-right corner of the page. NOVA audits HTTP/HTTPS pages, navigates findings, previews improvements, and uses a local WebSocket Agent to generate safety-constrained source diffs. Changes are written, verified, or rolled back only after explicit user confirmation.

## Repository layout

```text
apps/extension       Chrome/Edge Manifest V3 extension
apps/playground      Nuxt 3D cloud-fox demo and audit lab
packages/shared      Audit models and communication protocol
packages/local-agent Local-project WebSocket Agent
docs/                Usage, architecture, security, and development documentation
```

## Quick start

Requirements: Node.js 22+, Corepack, and pnpm 11.13.1.

```bash
corepack enable
pnpm install --frozen-lockfile
```

Start the services separately:

```bash
pnpm dev:playground
pnpm dev:agent
pnpm dev:extension
```

Recommended test page: `http://localhost:3000/audit-lab`.

## Chrome extension development and packaging

```bash
pnpm dev:extension
pnpm build:extension
pnpm zip:extension
```

Load this directory in Chrome developer mode:

```text
apps/extension/.output/chrome-mv3
```

Upload this ZIP to the Chrome Web Store:

```text
apps/extension/.output/novaextension-0.6.10-chrome.zip
```

## Core capabilities

- Vue 3 + WXT Manifest V3 extension with a Side Panel;
- procedural TresJS cloud-fox pet with motions, dragging, menus, and switchable voices;
- page audit, finding navigation, performance metrics, and reversible DOM preview;
- Fetch/XHR capture, Mocking, delay, whole-JSON response modification, and rule workbench;
- token-authenticated local WebSocket Agent;
- SHA-256 concurrent-edit protection, explicit write confirmation, validation, and rollback.

## Documentation

- [Complete documentation index](docs/README.md)
- [Current project status](docs/en/PROJECT-STATUS.md)
- [Release and validation history](docs/en/RELEASE-HISTORY.md)
- [User guide](docs/en/USER-GUIDE.md)
- [Network Lab and Mock Workbench](docs/en/NETWORK-LAB-OPERATIONS.md)
- [Build, package, and release](docs/en/BUILD-AND-RELEASE.md)
- [Troubleshooting](docs/en/TROUBLESHOOTING.md)
- [Developer maintenance and code comments](docs/en/DEVELOPER-MAINTENANCE.md)
- [简体中文 README](README.zh-CN.md)
