# Build, Package, and Release Guide

> Applies to: v0.5.2 and later  
> Last verified: 2026-07-18  
> Covers clean builds, local packages, Chrome Web Store submission, staged releases, rollback, and API automation.

## 1. Release artifacts

A formal release should include:

```text
nova-browser-agent-vX.Y.Z-chrome.zip
nova-browser-agent-vX.Y.Z-source.zip
nova-browser-agent-vX.Y.Z.patch
SHA256SUMS.txt
RELEASE-NOTES-vX.Y.Z.md
```

Upload the WXT Chrome ZIP to the Chrome Web Store, not the source ZIP.

## 2. Prerequisites

- Node.js 22+;
- pnpm 11.13.1 through Corepack;
- Git;
- Stable Chrome;
- macOS, Linux, or Windows;
- Access to the dependency registry.

## 3. Synchronize the version

Update the root `package.json`, extension `package.json`, Manifest version in `wxt.config.ts`, README/release notes, and validation report. An update package must have a higher Manifest version than the published item.

Use semantic versioning: patch for fixes/docs, minor for backward-compatible features, and major for incompatible or major permission changes.

## 4. Clean build

Remove dependencies and generated output, then install exactly from the lockfile:

```bash
rm -rf node_modules apps/extension/.output apps/extension/.wxt packages/local-agent/dist
corepack enable
pnpm install --frozen-lockfile
```

Run all gates:

```bash
pnpm typecheck
pnpm test
pnpm test:network-domain
pnpm test:network-workbench
pnpm build:agent
pnpm build:extension
pnpm zip:extension
```

Do not release after any failed command.

## 5. Outputs

```text
apps/extension/.output/chrome-mv3
apps/extension/.output/novaextension-X.Y.Z-chrome.zip
packages/local-agent/dist
```

## 6. Artifact inspection

Check the generated Manifest, confirm Manifest V3, version, permissions, host permissions, Side Panel path, and absence of unintended high-risk permissions.

List ZIP contents and ensure `manifest.json` is at the ZIP root:

```bash
unzip -l apps/extension/.output/*-chrome.zip
```

Validate production JavaScript:

```bash
find apps/extension/.output/chrome-mv3 -name '*.js' -print0 \
  | xargs -0 -n1 node --check
```

Do not ship `node_modules`, `.git`, environment files, credentials, private keys, local path leakage, or remotely downloaded executable JavaScript. Chrome Web Store policy expects extension logic to be included in the package.

## 7. Local acceptance

Load `apps/extension/.output/chrome-mv3` from `chrome://extensions`, inspect extension errors, refresh a normal test page, and verify pet interactions, all three menu modes, audit flow, Side Panel, site master switch, nonexistent-endpoint Mocking, request-generated Mocking, disabled-by-default duplicates, real-response modification, charts, Local Agent, and all high-energy motions.

Restart Chrome and verify persistence and the default-off network state.

## 8. Final files and checksums

Rename the WXT ZIP to the release naming convention and generate SHA-256 with `sha256sum` or `shasum -a 256`. Exclude `node_modules`, `.output`, `.wxt`, `dist`, `.git`, `.env`, and OS metadata from the source ZIP.

## 9. First Chrome Web Store release

1. Register and configure a Chrome Web Store developer account.
2. Open the Chrome Developer Dashboard.
3. Select **Add new item**.
4. Upload the WXT Chrome ZIP.
5. Complete Store Listing, Privacy, Distribution, and optional Test instructions.
6. Resolve all warnings.
7. Submit for review.

Official references:

- https://developer.chrome.com/docs/webstore/publish/
- https://developer.chrome.com/docs/extensions/how-to/distribute

The current official upload limit is 2 GB, but NOVA packages should remain far smaller.

## 10. Listing and permissions

Describe a narrow single purpose: frontend page auditing, network performance analysis, local controllable Mocking, and a visual 3D pet entry point.

Document why NOVA needs `activeTab`, `scripting`, `storage`, `sidePanel`, and HTTP/HTTPS host access. State that Mocking is off by default and data remains local.

## 11. Updating an existing item

Increase the Manifest version, run the full clean build, upload the new ZIP to the existing item, update release notes and privacy details, and submit again. Deferred publishing can stage an approved release until the planned launch time.

Official staged MV3 release guidance:

- https://developer.chrome.com/docs/extensions/develop/migrate/publish-mv3

## 12. Chrome Web Store API v2

The API can upload and publish an existing item. Store Publisher ID, Extension ID, and authorization credentials in encrypted CI secrets.

Official references:

- https://developer.chrome.com/docs/webstore/using-api
- https://developer.chrome.com/docs/webstore/api/reference/rest/v2/publishers.items/publish

## 13. Rollback

Do not attempt a rollback by lowering the version. Keep stable source, package, checksum, Manifest, release notes, and validation report. Create a new higher-version hotfix from the last stable revision and submit it. Cancel an in-review submission when appropriate and replace it with the corrected package.

## 14. Release checklist

- [ ] All version locations match.
- [ ] Lockfile changes are intentional.
- [ ] Typecheck, tests, builds, and ZIP pass.
- [ ] Default site Mock switch is off.
- [ ] New permissions are documented.
- [ ] ZIP has `manifest.json` at its root.
- [ ] Production JS syntax passes.
- [ ] No credentials or generated dependency folders are included.
- [ ] SHA-256 is recorded.
- [ ] Local unpacked smoke test passes.
- [ ] Nonexistent-endpoint Mock does not call the real network.
- [ ] Turning the master switch off restores real traffic.
- [ ] Store listing, privacy, screenshots, and test instructions are current.

## 15. Common packaging failures

A version error means the Manifest version was not increased. A missing Manifest usually means the wrong directory was selected. An invalid ZIP often has an extra parent folder. Stale behavior requires deleting `.output/.wxt`, rebuilding, reloading the extension, and refreshing the target tab. Unexpected permission warnings require a new-old Manifest comparison.
