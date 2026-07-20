# Build, Package, and Release Guide

> Applies to `v0.6.10` and later compatible releases.  
> Covers clean builds, Chrome extension packaging, local acceptance, store submission, and rollback.

## 1. Requirements

- Node.js 22 or later;
- pnpm 11.13.1 through Corepack;
- Git;
- stable Chrome;
- access to the dependency registry.

```bash
node --version
corepack pnpm --version
git --version
```

## 2. Version synchronization

Before a formal release, update:

1. root `package.json`;
2. `apps/extension/package.json`;
3. the Manifest version in `apps/extension/wxt.config.ts`;
4. `README.zh-CN.md`, `README.en.md`, and store metadata;
5. `docs/zh-CN/RELEASE-HISTORY.md` and `docs/en/RELEASE-HISTORY.md`;
6. regression automation affected by the release.

The Manifest version uploaded to the Chrome Web Store must be greater than the published version.

The repository no longer adds per-version root files named `RELEASE-NOTES-vX.Y.Z.md` or `VALIDATION-vX.Y.Z.*.md`. User-facing notes belong in GitHub Releases or the release system; maintenance conclusions belong in the consolidated release history.

## 3. Clean build

### 3.1 Remove generated directories

macOS/Linux:

```bash
rm -rf node_modules
rm -rf apps/extension/.output apps/extension/.wxt
rm -rf apps/playground/.output apps/playground/.nuxt
rm -rf packages/local-agent/dist
```

Windows PowerShell:

```powershell
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item apps/extension/.output, apps/extension/.wxt -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item apps/playground/.output, apps/playground/.nuxt -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item packages/local-agent/dist -Recurse -Force -ErrorAction SilentlyContinue
```

### 3.2 Install locked dependencies

```bash
corepack enable
pnpm install --frozen-lockfile
```

Do not rebuild the lockfile unless the release intentionally changes dependencies.

### 3.3 Quality gates

```bash
pnpm check:documentation
pnpm typecheck
pnpm test
pnpm test:network-domain
pnpm test:network-workbench
pnpm build:agent
pnpm build:playground
pnpm build:extension
pnpm zip:extension
```

Do not continue the release after any command fails.

## 4. Build outputs

| Artifact | Path |
|---|---|
| Unpacked Chrome extension | `apps/extension/.output/chrome-mv3` |
| Chrome ZIP | `apps/extension/.output/novaextension-X.Y.Z-chrome.zip` |
| Local Agent | `packages/local-agent/dist` |
| Playground | `apps/playground/.output` |

Upload the WXT-generated Chrome ZIP to the Chrome Web Store, not the source ZIP.

## 5. Artifact inspection

### Manifest

```bash
cat apps/extension/.output/chrome-mv3/manifest.json
```

Confirm that:

- `manifest_version` is 3;
- version, name, and description are correct;
- permissions match the release;
- Side Panel paths and icons exist;
- no high-risk permission was added accidentally.

### ZIP structure

```bash
unzip -l apps/extension/.output/*-chrome.zip
```

`manifest.json` must be at the ZIP root, without an extra enclosing directory.

### JavaScript syntax

```bash
find apps/extension/.output/chrome-mv3 -name '*.js' -print0 \
  | xargs -0 -n1 node --check
```

### Prohibited content

The release package must not contain:

- `node_modules`, `.git`, `.env`, private keys, or test credentials;
- source maps that disclose local paths;
- remotely downloaded executable JavaScript;
- source archives or test output unrelated to extension runtime.

## 6. Local acceptance

1. Open `chrome://extensions`;
2. enable Developer mode;
3. load `apps/extension/.output/chrome-mv3`;
4. check the extension page, Service Worker, and Side Panel for errors;
5. refresh a normal HTTP/HTTPS test page;
6. complete these smoke checks:
   - pet rendering, dragging, menus, motions, and voices;
   - audit scope, finding navigation, and preview rollback;
   - Network Lab master switch, request categories, and charts;
   - manual rule creation, request-derived creation, editing, duplication, testing, and deletion;
   - Fetch/XHR Mocking, delay, and whole-JSON modification;
   - Local Agent connection, confirmation, validation, and rollback;
7. restart the browser and verify persistence for site settings, rules, and voice selection.

## 7. Release archive

Keep these items in GitHub Releases or the release system:

```text
nova-browser-agent-vX.Y.Z-chrome.zip
nova-browser-agent-vX.Y.Z-source.zip
SHA256SUMS.txt
user-facing release notes
```

macOS:

```bash
shasum -a 256 nova-browser-agent-vX.Y.Z-chrome.zip > SHA256SUMS.txt
```

Linux:

```bash
sha256sum nova-browser-agent-vX.Y.Z-chrome.zip > SHA256SUMS.txt
```

Exclude `node_modules`, `.output`, `.wxt`, `.nuxt`, `dist`, `.git`, `.env`, and operating-system temporary files from the source ZIP.

## 8. Chrome Web Store release

1. Open the Chrome Developer Dashboard;
2. create an item or open the existing item;
3. upload the WXT-generated Chrome ZIP;
4. update name, descriptions, icons, screenshots, and release notes;
5. verify single purpose, permission justifications, and data handling;
6. provide test instructions when needed;
7. inspect warnings and submit for review;
8. prefer delayed or limited release for high-risk changes.

Suggested single-purpose statement:

> NOVA is a page-audit, network-performance, and locally controlled Mock-debugging tool for frontend developers, with a visual 3D pet as its shortcut and status-feedback surface.

Mocking is disabled by default, and rules and settings remain local.

## 9. Rollback

The Chrome Web Store cannot roll back by lowering the version number. For a serious issue:

1. branch from the latest stable tag;
2. fix with a higher version number;
3. rerun every quality gate;
4. upload the corrective ZIP;
5. cancel the pending submission first when applicable;
6. retain the stable tag, Chrome ZIP, SHA-256 file, Manifest, and release notes.

## 10. Common problems

- **Version was not increased**: update the Manifest version in `wxt.config.ts` and rebuild.
- **Manifest is missing when loading unpacked**: select `.output/chrome-mv3`, not `.output`.
- **ZIP structure is invalid**: make sure `manifest.json` is directly at the ZIP root.
- **New code is absent**: delete `.output/.wxt`, rebuild, and reload both the extension and target page.
- **Permission warnings increased**: compare old and new Manifests, remove accidental permissions, or provide an accurate justification.
