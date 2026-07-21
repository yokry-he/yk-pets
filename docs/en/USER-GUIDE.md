# YK-PETS Browser Agent Complete User Guide

> Applies to the `v0.6.10` product baseline and the Pet Studio Phase 1–14 capabilities currently implemented on `agent/cloud-fox-studio-v0610`.  
> Current default pet: Zeph（云灵）.  
> Current default species: Cloud Fox（云狐）.  
> Release status: this guide primarily covers source builds and unpacked developer installation. Some Phase 14 capabilities are not yet distributed as a Chrome Web Store release.

## Contents

1. [What YK-PETS is](#1-what-yk-pets-is)
2. [Usage modes and components](#2-usage-modes-and-components)
3. [Requirements and known limitations](#3-requirements-and-known-limitations)
4. [Build and load the browser extension](#4-build-and-load-the-browser-extension)
5. [First use](#5-first-use)
6. [Interact with Zeph in a web page](#6-interact-with-zeph-in-a-web-page)
7. [Use the Side Panel](#7-use-the-side-panel)
8. [Complete page-audit workflow](#8-complete-page-audit-workflow)
9. [Network Lab and mocking](#9-network-lab-and-mocking)
10. [Connect the YK-PETS Local Agent](#10-connect-the-yk-pets-local-agent)
11. [Generate, apply, verify, and roll back source patches](#11-generate-apply-verify-and-roll-back-source-patches)
12. [Motion voices and voice presets](#12-motion-voices-and-voice-presets)
13. [Complete Pet Studio guide](#13-complete-pet-studio-guide)
14. [Synchronize a Studio appearance to the extension](#14-synchronize-a-studio-appearance-to-the-extension)
15. [Recipe import, export, and data locations](#15-recipe-import-export-and-data-locations)
16. [Upgrade, back up, reset, and uninstall](#16-upgrade-back-up-reset-and-uninstall)
17. [Permissions, security, and privacy boundaries](#17-permissions-security-and-privacy-boundaries)
18. [Accessibility, performance, and reduced motion](#18-accessibility-performance-and-reduced-motion)
19. [Troubleshooting](#19-troubleshooting)
20. [Complete manual acceptance checklist](#20-complete-manual-acceptance-checklist)
21. [Command reference](#21-command-reference)
22. [Glossary and further reading](#22-glossary-and-further-reading)

---

## 1. What YK-PETS is

YK-PETS is an in-page 3D AI frontend engineering companion platform. The default pet, Zeph, appears in the bottom-right corner of normal web pages and provides:

- 3D pet interaction, motions, dragging, and voice feedback;
- performance, accessibility, SEO, best-practice, and DOM-structure audits;
- finding navigation and reversible page-preview repairs;
- Fetch/XHR capture, delays, mocks, and whole-JSON response replacement;
- a local project Agent for source-diff generation, confirmed writes, validation, and rollback;
- Pet Studio appearance editing and synchronization of saved appearances to the browser extension.

Keep these three concepts separate:

```text
Product brand: YK-PETS
Pet name: Zeph / 云灵
Pet species: Cloud Fox / 云狐
```

Changing a pet name or adding a new species must not rename the YK-PETS product.

---

## 2. Usage modes and components

YK-PETS has three main parts.

| Component | Main purpose | Required |
|---|---|---|
| Chrome/Edge extension | In-page Zeph, page audits, Side Panel, Network Lab, and motion voices | Yes |
| YK-PETS Local Agent | Read a local project, generate and apply source patches, run checks, and roll back | Only for source changes |
| Playground / Pet Studio | Edit Cloud Fox appearances, preview motions, import/export, and sync the extension | For appearance creation and testing |

### 2.1 Page auditing only

Install the extension only. You can:

- audit pages;
- navigate findings;
- preview temporary repairs;
- use Network Lab;
- play pet motions and voices.

### 2.2 Modify local project source

Run the Local Agent in addition to the extension, then enter its address and token in the Side Panel.

### 2.3 Create a custom pet appearance

Run the Playground and open `/studio`. The current development extension can receive the saved recipe and apply it to the production pet.

---

## 3. Requirements and known limitations

### 3.1 Development environment

- Node.js 22 or later;
- Corepack;
- pnpm 11.13.1;
- Chrome or Edge with Manifest V3 Side Panel support;
- a normal `http://` or `https://` page for extension testing.

Verify the environment first:

```bash
node --version
corepack --version
```

### 3.2 Browser restrictions

The extension cannot inject into:

- browser-internal pages such as `chrome://` or `edge://`;
- Chrome Web Store or Edge Add-ons pages;
- pages where browser security policy blocks extension scripts;
- some built-in PDF, download, or sandboxed pages.

### 3.3 Audio restrictions

The browser may require a user click before motion audio can play. System voice quality also depends on the Chinese TTS voices installed on the operating system.

### 3.4 Current development boundary

Phase 14 implements `pet-core`, `<yk-pet>`, the Vue adapter, and Studio recipe synchronization. A manual end-to-end check is still recommended after every extension rebuild.

---

## 4. Build and load the browser extension

### 4.1 Install dependencies

From the repository root:

```bash
corepack enable
corepack prepare pnpm@11.13.1 --activate
pnpm install --frozen-lockfile
```

`--frozen-lockfile` ensures that installation matches the committed lockfile.

### 4.2 Build the extension

```bash
pnpm build:extension
```

The unpacked build directory is:

```text
apps/extension/.output/chrome-mv3
```

### 4.3 Load in Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Select **Load unpacked**.
4. Choose `apps/extension/.output/chrome-mv3`.
5. Pin YK-PETS to the toolbar for convenient Side Panel access.
6. Refresh existing test tabs.

### 4.4 Load in Edge

1. Open `edge://extensions`.
2. Enable Developer mode.
3. Select **Load unpacked**.
4. Choose the same `apps/extension/.output/chrome-mv3` directory.

### 4.5 Development watch mode

For ongoing extension development:

```bash
pnpm dev:extension
```

After code changes, it is still recommended to:

1. click Reload on the extension-management page;
2. refresh the target web page;
3. refresh any open Pet Studio tab.

Old tabs do not automatically receive a new Content Script.

### 4.6 Create a ZIP

```bash
pnpm zip:extension
```

The ZIP is produced in WXT's `.output` directory. The exact filename and version follow the manifest and build output.

---

## 5. First use

After loading the extension:

1. Open a normal web page, such as the project's `/audit-lab` test page.
2. Refresh the page.
3. Wait for Zeph to appear in the bottom-right corner.
4. Click Zeph and confirm that the radial menu opens.
5. Double-click Zeph and confirm that a page audit starts.
6. Click the YK-PETS toolbar icon and confirm that the Side Panel opens.
7. Select and preview a motion voice in the Side Panel.
8. You do not need to run the Local Agent unless you want to modify source files.

If Zeph does not appear, see [Troubleshooting](#19-troubleshooting).

---

## 6. Interact with Zeph in a web page

### 6.1 Basic interactions

| Action | Result |
|---|---|
| Click Zeph | Open or close the current menu |
| Double-click Zeph | Run a quick page audit |
| Right-click Zeph | Open engineering mode |
| Hover | Zeph follows the pointer without interrupting the active main motion |
| Drag | Move the pet within the current page |
| Mouse wheel | Change menu page when multiple pages exist |
| Escape | Close the open menu |
| Tab / Enter | Navigate and activate menu buttons with the keyboard |

### 6.2 Menu modes

The menu has three modes.

#### Features

- Page Audit;
- Open Full Report.

#### Motions

The current in-page extension menu exposes 18 selectable motions:

- Wave;
- Jump;
- Flap;
- Rest;
- Stretch;
- Eat;
- Backflip Landing;
- Tail Whirl / Tail Windmill;
- Diving Catch;
- Energy Burst;
- Shy Peek;
- Star Juggle;
- Cloud Nap;
- Sparkle Sneeze;
- Fireworks Show;
- Curious Scan;
- Antenna Charge;
- Tail Glow.

High-energy motions run longer. Selecting another motion manually interrupts the current one through a short neutral transition.

#### Engineering

- Network Lab;
- Connect Agent;
- Generate Patch;
- Apply Patch;
- Project Validation;
- Roll Back Patch.

Complex engineering actions open the Side Panel. The in-page pet never accesses the local file system directly.

### 6.3 Idle motions

When the page is visible, the menu is closed, no task is busy, and the system has not requested reduced motion, Zeph can play normal, lifestyle, high-energy, and rare easter-egg motions at different cooldown intervals.

Idle scheduling pauses while the page is in the background.

### 6.4 Audit-result shortcuts

After an audit, the notice card may provide:

- Previous finding;
- Next finding;
- Preview Repair / Undo Preview;
- Full Report.

Closing the notice card does not close the pet menu.

---

## 7. Use the Side Panel

Open the Side Panel from the YK-PETS toolbar icon or from an in-page action that requires details.

### 7.1 Header

The header shows:

- the current extension version;
- Agent status;
- the active workspace.

### 7.2 Pet entry card

The entry card explains click, double-click, right-click, and drag interactions. Use **Call** to make Zeph display feedback.

### 7.3 Motion voice card

You can select and preview:

- Nebula Alien;
- Cute Girl;
- Cute Animal;
- Mute.

### 7.4 Workspace tabs

The main workspaces are:

- Page Audit;
- Network Lab.

### 7.5 Agent panel

The Agent panel accepts:

- WebSocket address;
- connection token.

After a successful connection it displays the project and connection status.

### 7.6 Patch panel

After patch generation, the panel can show:

- the reason for the change;
- confidence;
- target file;
- a diff or candidate source files;
- Apply, Run Checks, and Roll Back actions;
- PASS / FAIL status and summarized output for each check.

---

## 8. Complete page-audit workflow

### 8.1 Select audit scope

The Side Panel exposes 16 individual rules grouped by category. A parent category can select or clear all child rules, and each rule can be toggled independently.

#### Performance

- Images without intrinsic dimensions;
- below-the-fold images without lazy loading;
- slow complete navigation;
- long main-thread tasks;
- large network resources.

#### Accessibility

- Images without alternative text;
- form controls without accessible names;
- buttons without accessible names;
- links without accessible names;
- skipped heading levels.

#### SEO

- Missing document title;
- missing Meta Description.

#### Best practices

- Missing viewport configuration;
- insecure resources on an HTTPS page.

#### DOM / structure

- Duplicate IDs;
- excessive DOM size.

Unchecked rules do not run. If all rules are cleared, the audit button is disabled.

### 8.2 Start an audit

Use any of these methods:

- double-click the in-page pet;
- choose Page Audit from the Features menu;
- click **Start Page Audit** in the Side Panel.

A quick audit started from the pet uses the most recently saved Side Panel rule scope.

### 8.3 Review results

Results include:

- page health score;
- DOM node count;
- resource count and transferred bytes;
- LCP;
- CLS;
- high-, medium-, and low-severity finding counts;
- the categories and rules actually executed.

Findings can be filtered by severity and category.

### 8.4 Navigate a finding

Click a finding card or use Previous / Next in the pet notice. The extension:

1. scrolls to the target element;
2. draws an outline in an independent overlay;
3. shows the finding title;
4. does not change page layout or intercept clicks on the target.

### 8.5 Preview a repair

Some rules offer a reversible preview:

1. click **Preview Repair**;
2. the extension snapshots existing attributes and inline styles;
3. the temporary change is applied to the current DOM;
4. click **Undo Preview** to restore it.

A preview does not modify source code or server data. Reloading the page also clears it.

### 8.6 Audit boundaries

The health score helps prioritization and explanation. It does not replace Lighthouse, real-user monitoring, or a complete security scan. Suggested accessible names and alt text still require human semantic review.

---

## 9. Network Lab and mocking

### 9.1 Open Network Lab

Use:

- the Network Lab Side Panel tab;
- the Engineering pet menu;
- a navigation action from an audit or engineering workflow.

### 9.2 Request capture

Network Lab can inspect current-page Fetch and XHR requests, including:

- URL and method;
- status code;
- duration;
- resource type;
- query parameters;
- request headers;
- response headers;
- request-body preview;
- response preview.

After an extension reload, refresh the target page to receive the current network-capture script.

### 9.3 Filter and analyze

Filter by:

- request type;
- status;
- search text;
- slow or abnormal requests.

Expand a request to inspect its detailed fields.

### 9.4 Create a rule from a request

Typical workflow:

1. select a captured request;
2. create a rule from it;
3. configure URL and method matching;
4. choose delay, mocked status, or response modification;
5. save the rule;
6. trigger the request again;
7. inspect the hit state and resulting response.

### 9.5 Delay

Add delay to matched Fetch/XHR requests to simulate slow networking and test loading states.

### 9.6 Mock status, headers, and body

A rule can change:

- HTTP status;
- response headers;
- text or JSON response body.

Whole-JSON replacement is useful for success, empty-data, error, and boundary cases. Avoid enabling test rules carelessly on production accounts containing sensitive data.

### 9.7 Site controls

Network rules are enabled per site. After testing:

- disable the site's network capability; or
- disable or delete test rules;
- refresh the page and verify that real requests are restored.

### 9.8 Scope of impact

Mocks affect request handling in the current browser page and do not change server databases. A page may still perform follow-up actions based on a mocked response, so use care on important business pages.

---

## 10. Connect the YK-PETS Local Agent

### 10.1 When the Agent is required

The Agent is required to:

- locate local source candidates;
- generate a source diff;
- write files;
- run project checks;
- roll back the most recent patch written by YK-PETS.

Page audits, DOM previews, and Network Lab do not require the Agent.

### 10.2 Run from this repository

```bash
pnpm dev:agent
```

### 10.3 Use the built CLI

```bash
yk-pets-agent dev --root /path/to/project
```

During the compatibility period, `nova-agent` may remain as a legacy alias.

### 10.4 Startup information

The Agent displays:

- WebSocket address, usually `ws://127.0.0.1:4736`;
- a random connection token;
- project root;
- project name;
- detected framework;
- package manager;
- allowed scripts.

### 10.5 Connect from the Side Panel

1. Open the Agent panel.
2. Enter the WebSocket address.
3. Enter the connection token.
4. Click Connect.
5. Confirm that the status becomes connected.

The Agent listens only on the local loopback interface by default and does not accept LAN or Internet connections.

### 10.6 Agent configuration

The configuration file is:

```text
.yk-pets/agent.json
```

It contains local connection information and should be ignored by Git. When only `.nova/agent.json` exists, the Agent attempts to migrate the old token and port.

---

## 11. Generate, apply, verify, and roll back source patches

### 11.1 Prerequisites

- A page audit has been completed;
- a finding is selected;
- the Local Agent is connected;
- the Agent points to the correct project root.

### 11.2 Generate a patch

1. Select Generate Source Patch from a finding card or the Engineering menu.
2. The Agent searches candidate files using the finding evidence and source hints.
3. The Side Panel shows the target file, reason, confidence, and diff.
4. If confidence is insufficient, only candidates are shown and Apply is unavailable.

### 11.3 Review the diff

Verify that:

- the path belongs to the intended project;
- the change is limited to the current issue;
- unrelated code is not deleted;
- text, selectors, and attribute semantics are correct;
- no remote script, arbitrary command, or sensitive data is introduced.

### 11.4 Confirm the write

Source changes occur only after explicit confirmation. Before writing, the Agent:

1. confirms the path cannot escape the project root;
2. compares the SHA-256 captured during patch generation;
3. refuses to overwrite a file modified by another process;
4. creates a rollback backup;
5. writes the patch.

### 11.5 Run checks

Only predefined project scripts are allowed:

```text
typecheck
test
build
```

Commands run without shell-string concatenation. A page or model cannot provide arbitrary command arguments.

### 11.6 Roll back

After a patch is written, Roll Back restores the backup only if the file still matches the post-patch hash. If the file changed again, rollback is refused to protect later edits.

### 11.7 Recommended workflow

Even after all checks pass:

- inspect the Git diff;
- run the project's own browser regression;
- then decide whether to commit the change.

---

## 12. Motion voices and voice presets

### 12.1 Current presets

| Preset | Implementation | Notes |
|---|---|---|
| Nebula Alien | Bundled motion audio | Relatively consistent across devices; electronic style |
| Cute Girl | System Chinese TTS | Prefers natural, female, or enhanced Chinese voices |
| Cute Animal | System Chinese TTS | Higher pitch and more energetic rate |
| Mute | No voice playback | All motions remain available |

### 12.2 Switch and preview

1. Open the Side Panel.
2. Choose a preset in Motion Voice.
3. Click Preview.
4. Confirm that the status reports playback or a clear error.

The selection is stored in extension-local storage.

### 12.3 No sound

Check:

- whether the page has received a user click;
- system or tab mute state;
- whether Mute is selected;
- whether bundled audio can play directly;
- whether the OS has a Chinese TTS voice;
- whether the extension was reloaded while the Side Panel remained open.

System voices depend on the current device, so automated tests cannot guarantee identical sound quality across operating systems.

---

## 13. Complete Pet Studio guide

### 13.1 Start Pet Studio

```bash
pnpm dev:playground
```

Open:

```text
http://localhost:3000/studio
```

### 13.2 Page layout

Pet Studio contains:

- left-side tab navigation;
- central live 3D preview;
- view and background toolbar;
- motion test toolbar;
- right-side configuration panel;
- top actions for undo, redo, randomize, reset, import, export, and save.

### 13.3 Identity

Edit:

- Chinese name;
- English name;
- pet ID.

When the English name loses focus, the monogram is regenerated and the default chest symbol is updated.

### 13.4 Head and expression

Configure:

- ear style, outer color, inner color, and tip color;
- eye style;
- nose style;
- mouth style;
- head size;
- ear size;
- eye size;
- eye spacing.

All proportions remain inside species-defined safe ranges.

### 13.5 Body

Configure:

- body shape;
- body width, height, and depth;
- limb length, thickness, and spacing;
- paw size;
- coat color and derived lighting colors.

#### White belly patch

Supported controls:

- visible / hidden;
- Classic Oval;
- Shield;
- Soft Bean;
- Teardrop;
- Heart;
- width;
- height;
- vertical position.

The belly patch is a thin surface layer. After using extreme dimensions, inspect left and right views for intersection or floating edges.

### 13.6 Tail, antennae, and front paws

Configure:

- overall tail style;
- tail length, width, root connection, and per-segment offsets;
- tail-tip glow;
- antenna style and scale;
- front-paw style;
- paw-root embedding, forward offset, spread angle, and shoulder, wrist, and palm scales.

After changing tail or paws, test Spinning, Backflip, Tail Tornado, Playing Ball, Diving Catch, and Cloud Nap.

### 13.7 Glow and body orbit

Configure:

- fixed, motion-linked, or rainbow glow mode;
- global glow intensity;
- body-orbit visibility;
- ring count;
- radius;
- vertical scale;
- tilt;
- speed;
- intensity;
- particle count;
- primary and secondary orbit colors.

Turning off **Show Orbit** should hide every persistent orbit and orbit particle.

### 13.8 Chest and back symbols

#### Chest display modes

- None;
- Energy Core only;
- Custom Symbol only;
- Core + Symbol hybrid.

Both chest and back symbols support:

- visibility;
- one to three characters;
- color;
- size;
- rotation;
- glow intensity;
- horizontal position;
- vertical position;
- depth position.

If the chest symbol is not visible, confirm that the display mode is not Energy Core only, then adjust the depth position.

### 13.9 Views and backgrounds

Views:

- Front;
- Left;
- Back;
- Right.

Backgrounds:

- Dark;
- Light;
- Simulated web page.

Inspect all four views after changing any protruding part.

### 13.10 The 30 Studio motions

The motion selector has four groups.

#### State and emotion

- Idle;
- Sleeping;
- Thinking;
- Happy;
- Talking;
- Excited;
- Confused;
- Waking;
- Listening.

#### Basic motions

- Greeting;
- Happy Dance;
- Spinning;
- Jumping;
- Flapping;
- Resting;
- Stretching.

#### Interaction and props

- Playing Ball;
- Eating;
- Diving Catch;
- Shy Peek;
- Star Juggle;
- Cloud Nap;
- Sparkle Sneeze;
- Curious Scan.

#### Energy and glow

- Backflip;
- Tail Tornado;
- Energy Burst;
- Fireworks Show;
- Antenna Charge;
- Tail Glow.

Selecting the same motion again restarts it.

### 13.11 Undo, redo, and save

- A checkpoint is created before an adjustment;
- Undo restores the previous step;
- Redo reapplies an undone step;
- Save Appearance writes the local Studio recipe and attempts extension synchronization;
- the header indicates unsaved state.

### 13.12 Randomize and reset

- Randomize changes appearance inside safe ranges;
- Reset restores the production extension's classic appearance;
- Reset requires confirmation.

### 13.13 Import and export

Export downloads:

```text
<petId>-appearance-v2.json
```

Importing an older recipe automatically adds belly, chest display, symbol position, front-paw, and orbit fields. Unknown values fall back to safe defaults.

---

## 14. Synchronize a Studio appearance to the extension

### 14.1 Prerequisites

- Use an extension build containing Phase 14 synchronization;
- the extension has been loaded or reloaded;
- the Pet Studio tab was refreshed after extension loading;
- the Studio URL is trusted.

Supported development URLs include:

```text
http://localhost:<port>/studio
http://127.0.0.1:<port>/studio
```

Project deployments support hosts containing `yk-pets` on the `/studio` path, plus:

```text
https://yokry-he.github.io/yk-pets/studio
```

Normal websites cannot write pet recipes into the extension.

### 14.2 Synchronization steps

1. Change an obvious Studio appearance value, such as coat color, belly style, or chest text.
2. Click Save Appearance.
3. Studio completes its local save first.
4. Studio wraps the appearance in a versioned recipe envelope.
5. The page bridge sends the recipe to the extension.
6. The extension validates it and writes it to `chrome.storage.local`.
7. The extension returns an explicit success or error result.
8. Running production pets load the new recipe and update.

### 14.3 Extension not installed

The local Studio save still succeeds. A timeout or missing extension does not roll back the local recipe.

### 14.4 Verify synchronization

Verify at least:

- coat color;
- one of the five belly styles;
- chest display mode;
- chest symbol size or position;
- back `YK` position;
- production in-page motions still play.

### 14.5 No immediate update

1. Confirm that Save Appearance was clicked and the Studio is not merely in an unsaved state.
2. Reload the extension on the extension-management page.
3. Refresh the Studio page and save again.
4. Refresh the normal web page to receive the newest Content Script.
5. Confirm that the Studio URL is trusted.
6. Confirm that an active recipe exists in extension storage.

---

## 15. Recipe import, export, and data locations

### 15.1 Studio appearance

The current Studio appearance storage key is:

```text
yk-pets:studio:appearance:v2
```

### 15.2 Extension active recipe

The versioned recipe synchronized to the extension is stored under:

```text
yk-pets:active-recipe:v1
```

Note:

- `protocolVersion` is the Studio-to-extension envelope protocol version;
- `schemaVersion` inside the appearance is the concrete appearance-structure version;
- they are not the same version number.

### 15.3 Local Agent

```text
.yk-pets/agent.json
```

### 15.4 Legacy migration

During compatibility, YK-PETS still recognizes selected:

- `nova:*` extension settings;
- `.nova/agent.json`;
- `nuxt-ai-pet-state-v1` Playground state.

Do not edit these storage values manually unless diagnosing migration behavior.

### 15.5 Backup recommendations

- Export pet appearance JSON regularly;
- inspect Git status before source changes;
- never commit the Local Agent token file;
- export important recipes before clearing extension data or upgrading.

---

## 16. Upgrade, back up, reset, and uninstall

### 16.1 Update a source build

After updating the repository:

```bash
pnpm install --frozen-lockfile
pnpm build:extension
```

Then:

1. reload the extension;
2. refresh the Side Panel;
3. refresh normal web pages;
4. refresh Pet Studio;
5. repeat one Studio-to-extension sync test.

### 16.2 Restore the classic pet appearance

In Studio, click Reset, confirm, then save and synchronize.

### 16.3 Reset extension settings

Clear extension site data from the extension-management page or reinstall the extension. This removes voice selection, the active recipe, and other local preferences.

### 16.4 Reset the Local Agent

Delete:

```text
.yk-pets/agent.json
```

A new token is generated on the next startup.

### 16.5 Uninstall

1. Remove YK-PETS from the browser extension manager.
2. Stop the Local Agent process.
3. Delete `.yk-pets/` from projects when a complete local reset is required.
4. Clear the relevant browser Local Storage to reset Studio state.

---

## 17. Permissions, security, and privacy boundaries

### 17.1 Extension page permissions

The current development build uses broad HTTP/HTTPS host permissions so an unpacked extension can audit pages without per-site configuration. A store release is expected to move toward user-triggered and per-site authorization.

### 17.2 Web pages are untrusted input

Page DOM, attributes, requests, and audit evidence are treated as untrusted input. The extension does not execute page-provided JavaScript and does not use `eval` or `new Function`.

### 17.3 Shadow DOM isolation

The in-page pet and notices use Shadow DOM to reduce interference from host-page CSS.

### 17.4 Studio synchronization boundary

Only trusted Studio hosts and paths can send recipes. A message must:

- come from the current window;
- be same-origin with the page;
- satisfy the sync-request structure;
- contain a normalizable recipe envelope.

### 17.5 Agent security

- listens only on `127.0.0.1`;
- uses a random authentication token;
- accesses only the specified project root;
- checks paths and file hashes before writing;
- requires explicit user confirmation;
- runs only predefined validation scripts;
- does not accept arbitrary shell commands from a page.

### 17.6 Data storage

Primary data is stored in local browser storage and local project files. Avoid putting unnecessary secrets in recipe text, mock responses, or project logs.

---

## 18. Accessibility, performance, and reduced motion

- Menu controls support Tab and Enter;
- notices use status semantics;
- the finding highlight overlay does not accept pointer input;
- narrow-screen menus should not create page-level horizontal scrolling;
- when `prefers-reduced-motion: reduce` is enabled, high-energy effects and idle activity are reduced;
- idle scheduling pauses while the page is hidden;
- Studio avoids full-screen Bloom to reduce rendering cost when the pet is injected into normal pages;
- on low-performance devices, disable body orbits, lower particle counts, and avoid fireworks or other high-energy motions.

---

## 19. Troubleshooting

### 19.1 Zeph does not appear in the bottom-right corner

Check:

- the page is a normal HTTP/HTTPS page;
- the extension is enabled;
- the page was refreshed after an extension update;
- the Content Script console has no error;
- page CSP or browser policy is not blocking extension injection.

### 19.2 Only an `N` loader button appears

The 3D Vue/TresJS component did not load successfully. The button can still open the report. Inspect extension build output, console errors, and dependency installation.

### 19.3 `<yk-pet>` reports no renderer available

The Web Component is registered, but the `extension-cloud-fox` renderer adapter did not register. Rebuild the extension and verify that the Vue adapter and production canvas are bundled.

### 19.4 Side Panel cannot connect to the page

Refresh the target tab after reloading the extension. Old tabs do not automatically receive an updated Content Script.

### 19.5 Double-click does not start an audit

- confirm the gesture was not treated as a drag;
- ensure at least one audit rule is enabled;
- inspect page errors in the Side Panel;
- confirm the page is not browser-restricted.

### 19.6 Finding outline is misplaced

The page layout may have changed. Select the finding again or rerun the audit. On continuously animated pages, scroll and locate again.

### 19.7 Preview cannot be applied

The finding may have no reversible preview, or the target element was changed, removed, or cannot be relocated. Rerun the audit.

### 19.8 Network Lab shows no requests

- refresh the page to trigger requests;
- confirm the request uses Fetch or XHR;
- refresh the tab after extension reload;
- confirm site-level network capability is enabled;
- check whether traffic uses Service Workers, WebSocket, or another unsupported channel.

### 19.9 A mock rule does not match

Check URL, method, enabled state, site switch, and rule priority. Trigger the request again after saving the rule; refreshing only the Network Lab panel is not sufficient.

### 19.10 Agent cannot connect

- confirm the Agent process is running;
- use `ws://127.0.0.1:<port>`;
- enter the complete token;
- confirm the Side Panel belongs to the latest extension build;
- verify the project root;
- check local firewall or security software.

### 19.11 Only source candidates are shown

Source mapping confidence is insufficient. You can:

- add a stable ID or `data-testid`;
- keep meaningful resource filenames;
- inspect candidates manually;
- avoid bypassing the confidence restriction.

### 19.12 Write refused because the hash changed

Another tool changed the file after patch generation. Generate a new patch instead of overwriting concurrent work.

### 19.13 Rollback refused

The file changed again after the patch was written. Preserve later changes and use Git or the backup manually rather than forcing rollback.

### 19.14 Motions have no sound

See [Motion voices and voice presets](#12-motion-voices-and-voice-presets) and ensure that the page has received a user interaction.

### 19.15 Studio save does not update the extension appearance

See [No immediate update](#145-no-immediate-update). The most common cause is failing to refresh Studio and normal-page tabs after reloading the extension.

### 19.16 Chest symbol is invisible

- check the chest display mode;
- check the symbol visibility toggle;
- increase size;
- move the depth position outward;
- check whether the energy core or belly patch occludes it.

### 19.17 Back symbol is hidden by the tail

Switch to Back view, move the symbol upward or farther outward, then play tail motions to verify dynamic occlusion.

### 19.18 Studio JSON import fails

Confirm that the file contains valid JSON. Older recipes may omit new fields, but the top level must still be an appearance object rather than a log, array, or archive.

---

## 20. Complete manual acceptance checklist

### 20.1 Extension basics

- [ ] Extension loads successfully;
- [ ] Zeph appears on a normal page;
- [ ] click, double-click, right-click, hover, and drag work;
- [ ] Side Panel opens;
- [ ] menu is keyboard-operable.

### 20.2 Audit

- [ ] all 16 rules can be selected independently;
- [ ] clearing all rules disables auditing;
- [ ] score and metrics appear;
- [ ] finding filters work;
- [ ] locating does not block target interaction;
- [ ] preview and undo work.

### 20.3 Network Lab

- [ ] Fetch/XHR capture works;
- [ ] request details are complete;
- [ ] delay rules work;
- [ ] status, header, and body mocks work;
- [ ] whole-JSON replacement works;
- [ ] real requests return after rules are disabled.

### 20.4 Local Agent

- [ ] Agent listens only locally;
- [ ] correct token connects;
- [ ] incorrect token is rejected;
- [ ] diff generation works;
- [ ] writes require confirmation;
- [ ] Typecheck, Test, and Build run;
- [ ] rollback works;
- [ ] concurrent modification prevents overwrite.

### 20.5 Audio

- [ ] all four voice choices can be selected;
- [ ] bundled alien audio is audible;
- [ ] system cute voices preview or report a clear failure;
- [ ] Mute produces no voice.

### 20.6 Pet Studio

- [ ] four views and three backgrounds work;
- [ ] five belly styles switch and resize;
- [ ] four chest modes work;
- [ ] chest and back symbols resize and move in XYZ;
- [ ] orbit visibility works;
- [ ] all 30 motions can replay;
- [ ] undo, redo, randomize, reset, import, and export work.

### 20.7 Studio-to-extension synchronization

- [ ] Studio local save succeeds;
- [ ] an installed extension returns a sync result;
- [ ] production Zeph updates colors and appearance;
- [ ] motions still work;
- [ ] local save remains successful without an extension;
- [ ] a normal non-Studio page cannot write a recipe.

---

## 21. Command reference

### Install

```bash
corepack enable
corepack prepare pnpm@11.13.1 --activate
pnpm install --frozen-lockfile
```

### Development

```bash
pnpm dev:extension
pnpm dev:playground
pnpm dev:agent
```

### Build

```bash
pnpm build:extension
pnpm build:agent
pnpm build:playground
pnpm zip:extension
```

### Validation

```bash
pnpm check:documentation
pnpm check:brand
pnpm check:cloud-fox-studio
pnpm check:pet-core-web-component
pnpm typecheck
pnpm test
pnpm build
pnpm build:playground
```

`pnpm typecheck` also runs documentation, brand, Pet Studio, motion, audit, Network Lab, audio, and architecture regression gates.

---

## 22. Glossary and further reading

### Glossary

| Term | Meaning |
|---|---|
| YK-PETS | Product brand |
| Zeph / 云灵 | Current default pet name |
| Cloud Fox / 云狐 | Current default pet species |
| Side Panel | Full browser-side operation workspace |
| Local Agent | Local-only project source collaboration service |
| Studio / Pet Studio | Appearance-recipe editing and motion-validation page |
| Recipe | Appearance and renderer-selection data, not a full Three.js scene |
| `<yk-pet>` | Web Component responsible for pet renderer lifecycle and adapter selection |
| `pet-core` | Framework-neutral recipe, species, renderer, and sync-contract package |

### Further reading

- [Documentation index](../README.md)
- [Cloud Fox Studio](./CLOUD-FOX-STUDIO.md)
- [Technical architecture](./ARCHITECTURE.md)
- [Security design and threat model](./SECURITY.md)
- [Network Lab operations](./NETWORK-LAB-OPERATIONS.md)
- [Build, package, and release](./BUILD-AND-RELEASE.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Developer maintenance](./DEVELOPER-MAINTENANCE.md)
