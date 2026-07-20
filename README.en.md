# YK-PETS Browser Agent

YK-PETS is an in-page 3D AI frontend engineering companion platform. The current default pet is a **Cloud Fox** named **Zeph**（云灵）. Zeph can audit HTTP/HTTPS pages, navigate findings, preview improvements, and use a local WebSocket Agent to generate safety-constrained source diffs. Changes are written, verified, or rolled back only after explicit user confirmation.

## Brand and pet identity

```text
Product brand: YK-PETS
Pet species: Cloud Fox / 云狐
Pet name: Zeph / 云灵
```

The product brand, pet species, and pet name are separate concepts. New species and named pets can be added later without renaming YK-PETS.

## Repository layout

```text
apps/extension       Chrome/Edge Manifest V3 extension
apps/playground      Nuxt 3D pet demo and audit lab
packages/shared      Brand, pet identity, audit models, and communication protocol
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

## Local Agent

The primary command is now:

```bash
yk-pets-agent dev --root .
```

For `v0.6.10` compatibility, `nova-agent` remains available as a temporary alias. Configuration is written to `.yk-pets/agent.json`. When only `.nova/agent.json` exists, YK-PETS migrates its token and port automatically.

## Core capabilities

- Vue 3 + WXT Manifest V3 extension with a Side Panel;
- a procedural TresJS Cloud Fox named Zeph, with motions, dragging, menus, and switchable voices;
- page audits, finding navigation, performance metrics, and reversible DOM previews;
- Fetch/XHR capture, mocking, delays, whole-JSON response modification, and a rule workbench;
- token-authenticated local WebSocket Agent;
- SHA-256 concurrent-edit protection, explicit write confirmation, validation, and rollback;
- compatibility migration from `nova:*` storage keys to `yk-pets:*`.

## Compatibility policy

During the `v0.6.10` migration, selected `Nova*`, `NOVA_*`, `@nova/*`, and `nova:*` technical identifiers remain as compatibility boundaries for existing extension messages, workspace dependencies, and user data. User-facing branding, the new domain model, the primary CLI, and the new configuration directory use YK-PETS.

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
