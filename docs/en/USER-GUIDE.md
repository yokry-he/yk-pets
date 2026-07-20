# YK-PETS Browser Agent User Guide

> Baseline: the `v0.6.10` platform branch and later compatible versions  
> Current pet: Zeph（云灵）  
> Current species: Cloud Fox（云狐）

## 1. Product components

YK-PETS consists of three cooperating parts:

| Component | Purpose | Required |
|---|---|---|
| Chrome/Edge extension | In-page Zeph, page audits, Network Lab, and Side Panel | Yes |
| YK-PETS Local Agent | Read local source, generate patches, run checks, and roll back | Only for source changes |
| Playground | Zeph demo, chat, and regression laboratory | Development only |

YK-PETS is the product brand. Zeph is the pet's name. Cloud Fox is the species.

## 2. Install the extension

### 2.1 Build from source

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build:extension
```

Enable developer mode in Chrome or Edge and load:

```text
apps/extension/.output/chrome-mv3
```

### 2.2 Create a release ZIP

```bash
pnpm zip:extension
```

The archive is written to:

```text
apps/extension/.output/yk-pets-0.6.10-chrome.zip
```

The actual version follows the extension manifest.

## 3. First use

1. Install or reload the extension.
2. Refresh a normal `http://` or `https://` page.
3. Wait for Zeph to appear in the bottom-right corner.
4. Click Zeph to open the feature menu.
5. Double-click Zeph to run a quick page audit.
6. Click the YK-PETS toolbar action to open the Side Panel.

Extensions cannot inject into browser-internal pages, extension stores, or other protected pages.

## 4. Interacting with Zeph

| Interaction | Result |
|---|---|
| Click | Toggle the feature menu |
| Double-click | Run a page audit immediately |
| Right-click | Open engineering tools |
| Hover | Greet and follow the pointer |
| Drag | Change the in-page position |
| Select a motion | Play the motion and associated voice |

Zeph's identity is represented separately from the product:

```text
petId: zeph
speciesId: cloud-fox
Name: Zeph / 云灵
Species: Cloud Fox / 云狐
```

## 5. Page audits

1. Open the feature menu or Side Panel.
2. Select audit categories and individual rules.
3. Run the page audit.
4. Review health score, metrics, and findings.
5. Navigate or highlight a finding.
6. Use Preview when a reversible DOM change is supported.
7. A preview changes only the current page DOM; it does not write source code.
8. Use Undo Preview to restore the page.

The audit will not start when no rule is selected.

## 6. Network Lab

Network Lab supports:

- Fetch/XHR capture;
- type and status filters;
- request delays;
- mocked status, headers, and response bodies;
- whole-JSON response replacement;
- rule creation from captured requests;
- rule editing, duplication, enable/disable, and deletion;
- site-level controls.

Mocking affects only the current browser page and does not change server data.

## 7. Connect the Local Agent

From a project root, run:

```bash
pnpm dev:agent
```

Or use the built CLI:

```bash
yk-pets-agent dev --root /path/to/project
```

The command prints the WebSocket address, connection token, project name, framework, and package manager. Enter the address and token in the Side Panel. The Agent listens on the local loopback interface by default.

## 8. Source patch lifecycle

```text
Page finding
  → Locate source candidates
  → Generate minimal diff
  → User confirmation
  → Verify file hash
  → Create backup
  → Write source
  → Run checks
  → Keep or roll back
```

No source is written without explicit confirmation. Allowed project checks are limited to:

```text
typecheck
test
build
```

## 9. Data migration

### Extension settings

YK-PETS migrates legacy keys from:

```text
nova:*
```

to:

```text
yk-pets:*
```

During the compatibility period, both prefixes are mirrored so existing components retain their settings.

### Local Agent

The new configuration path is:

```text
.yk-pets/agent.json
```

When only `.nova/agent.json` exists, the Local Agent migrates the existing token and port. Both directories should remain ignored by Git.

### Playground

The old `nuxt-ai-pet-state-v1` key migrates to:

```text
yk-pets:playground:pet-state:v2
```

Theme, affection, interaction count, and secret-mode state are retained.

## 10. Voice presets

Current presets include:

- Nebula Alien;
- Cute Girl;
- Cute Animal;
- Mute.

Browsers may require a user click before audio playback is permitted. The selected preset is persisted.

## 11. Validation commands

```bash
pnpm check:brand
pnpm typecheck
pnpm test
pnpm build
pnpm build:playground
```

`pnpm typecheck` also runs documentation, brand, pet-motion, audit, Network Lab, and audio regression gates.

## 12. Uninstall and reset

- Remove YK-PETS from the browser extension manager.
- Delete `.yk-pets/` to reset the Local Agent token.
- Clear extension storage to reset YK-PETS preferences.
- Clear Playground Local Storage to reset affection and interaction state.

Deleting `.yk-pets/agent.json` causes a new connection token to be generated at the next startup.
