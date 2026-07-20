# YK-PETS Build, Package, and Release Guide

> Baseline: the `v0.6.10` platform branch and later compatible releases

## 1. Requirements

- Node.js 22 or later;
- Corepack;
- pnpm 11.13.1;
- Chrome or Edge;
- a clean working tree for release builds.

```bash
node --version
corepack enable
corepack prepare pnpm@11.13.1 --activate
pnpm --version
```

## 2. Install dependencies

```bash
pnpm install --frozen-lockfile
```

When frozen installation fails, check whether `package.json` and `pnpm-lock.yaml` are synchronized. Do not delete the lockfile and create an unrelated large dependency update.

## 3. Release validation

Run these commands in order:

```bash
pnpm check:brand
pnpm typecheck
pnpm test
pnpm build
pnpm build:playground
```

- `check:brand` validates YK-PETS, Zeph, Cloud Fox, compatibility migration, and release naming.
- `typecheck` runs documentation and focused regression gates before all workspace typechecks.
- `test` runs workspace tests.
- `build` builds the Local Agent and extension.
- `build:playground` builds the Nuxt demo.

Do not publish when any step fails.

## 4. Extension development build

```bash
pnpm dev:extension
```

The development output is normally:

```text
apps/extension/.output/chrome-mv3
```

Load this directory in the browser extension manager and verify at least:

1. the manifest name is `YK-PETS Browser Agent`;
2. the toolbar title uses YK-PETS;
3. Zeph appears in-page instead of NOVA;
4. the Side Panel uses YK-PETS branding;
5. voices, motions, audits, Network Lab, and Agent connection work.

## 5. Production builds

```bash
pnpm build:extension
pnpm build:agent
pnpm build:playground
```

Outputs:

```text
apps/extension/.output/chrome-mv3
packages/local-agent/dist
apps/playground/.output
```

## 6. Create the extension ZIP

```bash
pnpm zip:extension
```

The WXT configuration uses this artifact template:

```text
yk-pets-{{version}}-{{browser}}.zip
```

The current version should produce:

```text
apps/extension/.output/yk-pets-0.6.10-chrome.zip
```

Extract the archive before submission and ensure `manifest.json` is at the ZIP root.

## 7. Local Agent command

Primary command:

```bash
yk-pets-agent dev --root .
```

Compatibility alias:

```bash
nova-agent dev --root .
```

Release notes should recommend only `yk-pets-agent`; the old command exists for migration.

## 8. Configuration and privacy checks

Do not commit or package:

```text
.env
.env.*
.yk-pets/
.nova/
node_modules/
coverage/
```

`.yk-pets/agent.json` and `.nova/agent.json` can contain a local connection token.

## 9. Browser acceptance

On a normal HTTPS page and the Playground audit page, verify:

- Zeph loading, dragging, menus, motions, and voices;
- identity displayed as Zeph（云灵）, species Cloud Fox（云狐）;
- page audit and rule scope;
- finding highlight, preview, and undo;
- Network Lab capture, filters, and mocking;
- Local Agent connection;
- patch generation, explicit apply, checks, and rollback;
- existing `nova:*` settings continue to work after upgrade;
- `.nova/agent.json` migrates to `.yk-pets/agent.json`.

## 10. Version updates

A formal release updates at least:

- root `package.json`;
- `apps/extension/package.json`;
- manifest version in `apps/extension/wxt.config.ts`;
- current project status;
- release history;
- release notes and generated artifacts.

The private `@nova/*` workspace scope can remain during the compatibility period, but it must not appear as the user-facing product or ZIP name.

## 11. GitHub Actions

The branch includes:

```text
.github/workflows/validate-yk-pets.yml
```

It runs frozen installation, brand validation, typechecks, tests, and all three main builds. Confirm the workflow is green before merging.

## 12. Rollback

When a release fails:

1. stop submission or withdraw the pending release;
2. retain logs and failed artifacts;
3. return to the latest commit with all gates passing;
4. do not delete user compatibility data under `.nova`;
5. fix the issue and rerun the full validation set;
6. regenerate the ZIP using the YK-PETS artifact name.
