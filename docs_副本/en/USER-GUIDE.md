# NOVA Browser Agent User Guide

> Applies to: v0.5.2 and later  
> Purpose: enable a first-time user to install NOVA and operate the pet, audits, Network Lab, Mock rules, performance analysis, and Local Agent without reading the source code.

## 1. Product components

| Component | Purpose | Required |
|---|---|---|
| Chrome extension | In-page pet, audits, Network Lab, Side Panel | Yes |
| Local Agent | Read local source, generate patches, validate, and roll back | Only for source changes |
| Playground | Official demonstration and regression test pages | Only for development |

The Chrome extension alone is enough for network inspection, Mocking, and performance analysis.

## 2. Install the extension

### 2.1 Install a prebuilt package

1. Extract `nova-browser-agent-<version>-chrome.zip`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the extracted directory whose top level directly contains `manifest.json`.
6. Pin the NOVA icon for quick Side Panel access.
7. Refresh the normal HTTP/HTTPS page where NOVA will run.

Do not select the ZIP file itself or the parent directory that merely contains the extension folder.

### 2.2 Build from source and install

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build:extension
```

Load this directory:

```text
apps/extension/.output/chrome-mv3
```

## 3. The in-page 3D pet

### 3.1 Basic interactions

| Interaction | Result |
|---|---|
| Single-click | Open or collapse the mode and radial action menu |
| Double-click | Start an audit of the current page |
| Hover | Play a lightweight greeting and follow the pointer |
| Drag | Reposition the pet within the viewport |
| Press Esc | Close the current menu |
| Click outside | Close the menu |

The menu has Feature, Motion, and Engineering modes. All mode actions use the same purple visual system.

### 3.2 Feature mode

Feature mode provides page auditing and issue navigation:

1. Start an audit.
2. Move to the previous or next issue.
3. Locate and highlight the affected element.
4. Preview a temporary repair.
5. Open the full report.

A preview only changes the current DOM. It does not write local source and disappears after a page refresh.

### 3.3 Motion mode

More than six motions are paginated. Pagination dots are anchored below the pet shadow.

Standard motions include waving, jumping, spinning, flapping, playing, resting, stretching, ball play, and eating. High-energy motions include:

- Backflip landing;
- Tail tornado;
- Diving ball catch;
- Energy burst.

Automatic motions pause or degrade when the page is hidden, the menu is open, the Agent is busy, or reduced motion is enabled.

### 3.4 Engineering mode

Engineering mode provides:

- Network Lab;
- Local Agent connection;
- Source patch generation;
- Confirmed file write;
- Typecheck/Test/Build;
- Latest patch rollback.

Complex content is handled in the Side Panel.

## 4. Open the Side Panel

Open it by:

- Clicking the NOVA toolbar icon;
- Selecting Network Lab from Engineering mode;
- Following an audit or patch detail action.

The Side Panel follows the active tab. Confirm that the origin shown at the top matches the intended site after switching tabs.

## 5. Network Lab quick start

### 5.1 Site-level master switch

The master switch is stored per website origin, for example:

```text
https://app.example.com
```

When enabled, NOVA may apply:

- Fetch/XHR Mock responses;
- Real JSON response transforms;
- Artificial delay.

Turning it off immediately stops those effects. Performance capture may remain active so real traffic can still be analyzed.

### 5.2 Request list

1. Open **Requests**.
2. Refresh the page or repeat the business action.
3. Filter by URL, method, or status.
4. Enable **Slow only** to show requests above the configured threshold.
5. Select a request to inspect its details.

Details include URL, method, status, total duration, transfer size, DNS/connect/TLS/TTFB/download timing, Mock/modified/delayed state, and a sanitized response preview.

## 6. Create Mock rules

### 6.1 Generate a Mock from an existing request

1. Open a request detail.
2. Click **Generate Mock**.
3. NOVA opens the full-page rule editor inside the Side Panel.
4. URL, method, status, and response preview are prefilled.
5. Edit the name and response.
6. Run the rule test and confirm that the test URL matches.
7. Save and enable the rule.
8. Repeat the page action and verify the Mock badge.

A full Mock returns a constructed response without calling the real endpoint.

### 6.2 Mock an endpoint that does not exist

1. Open **Rules**.
2. Click **New rule**.
3. Enter the future path, such as `/api/future-feature`.
4. Select the HTTP method.
5. Choose Glob or regular-expression matching.
6. Configure status, body type, body, and delay.
7. Test the rule.
8. Save and enable it.
9. When the page later sends a matching Fetch/XHR request, NOVA returns the custom response.

No server endpoint is required.

### 6.3 Duplicate a rule

Duplication is useful for success, empty, 401, 403, 500, and high-latency variants. The duplicate has a new ID and is disabled by default to avoid immediate conflicts.

## 7. Rule matching

Rules are selected by:

1. Higher priority;
2. Greater specificity;
3. Newer update time.

Glob examples:

```text
/api/users/*
https://api.example.com/v1/*
/api/orders?status=*
```

Regular-expression example:

```text
^https://api\.example\.com/v2/users/\d+$
```

Query conditions support equals, contains, and exists.

## 8. Edit Mock responses

Mock bodies may be JSON or text. The focused JSON editor supports formatting and syntax validation. Invalid JSON cannot be saved as a JSON body.

You can configure successful and error statuses, including 200, 201, 400, 401, 403, 404, 429, 500, 502, and 503, plus a fixed delay.

## 9. Modify a real response

A response-modification rule calls the real endpoint first, then transforms the JSON body.

Supported operations:

- `set`: create or replace a field;
- `remove`: delete a field.

Example:

```text
set data.user.vip = true
remove data.internalToken
```

Non-JSON responses are passed through unchanged.

## 10. Performance charts

The Overview page summarizes request count, slow count, errors, Mock count, transfer size, average duration, P95, and a score.

Charts include:

1. Slowest requests;
2. Transfer size by resource type;
3. Recent request waterfall.

Use TTFB, download time, body size, repetition, and the difference between real and Mocked loads to determine whether the main bottleneck is server/network behavior or frontend parsing/rendering.

## 11. Local Agent

Start it with:

```bash
pnpm dev:agent
```

Enter the printed WebSocket address and token in the Side Panel. The protected workflow is:

```text
Find issue
→ Generate candidate patch
→ Review diff
→ Explicitly confirm write
→ Run validation
→ Roll back when required
```

NOVA does not overwrite source without explicit confirmation.

## 12. Data and privacy

- Rules are stored locally in Chrome Storage.
- Previews are depth-, count-, and length-limited.
- Tokens, cookies, passwords, and secrets are sanitized.
- Network records are not uploaded by the current version.
- Rules default to the origin where they were created.
- Turn off the site master switch after a Mock session.

## 13. Recommended workflows

For an unfinished backend endpoint: create a manual Mock, duplicate scenario variants, develop the UI, and turn Mocking off after the real service is ready.

For a slow page: capture a fresh load, inspect the slowest requests and waterfall, Mock the slow endpoint, reload, and compare whether the remaining delay is frontend-side.

See [Troubleshooting](./TROUBLESHOOTING.md) for detailed recovery steps.

## v0.6.0 pet shows, lifestyle states, and easter eggs

The motion menu now includes Shy Peek, Star Juggling, Cloud Nap, Sparkle Sneeze, and High-altitude Fireworks. When motions exceed six items, use the page dots below the pet shadow or scroll the mouse wheel over the motion menu.

### High-altitude fireworks show

1. Open the pet menu.
2. Switch to **Motions**.
3. Navigate to **High-altitude Fireworks**.
4. Keep the current tab visible during playback.

The show launches three fireworks. Every launch selects a curated shape and palette. NOVA looks upward while the antennae, tail tip, and chest core brighten together.

### Automatic easter eggs

Sparkle Sneeze and High-altitude Fireworks can appear after a long idle period with a low probability. Automatic easter eggs are suspended while:

- The pet menu is open.
- The Agent or page audit is busy.
- The tab is hidden.
- Reduced motion is enabled.

Every easter-egg motion can still be triggered directly from the motion menu.

## v0.6.1 Motion continuity and active glow controls

### Triggering motions consecutively

Starting another motion while one is active no longer interrupts the current motion. NOVA stores one pending action and starts it after the current animation completes and passes through a short settling pose. Rapid input keeps the highest-priority or newest same-priority request.

### Pointer hover

Hover produces one greeting only when NOVA is fully idle. Entering or leaving the avatar during fireworks, ball play, cloud nap, backflip, or another primary motion does not replace the active animation. Pointer leave still lets gaze return smoothly to center.

### Explicit glow motions

Use later pages of Motion mode to trigger:

- **Antenna Charge**: both antennae converge while antenna tips, chest core, and data rings brighten together;
- **Tail Glow Flow**: tail middle, tip, trails, and stardust form a visible energy flow.

### Cloud Nap

Cloud Nap places NOVA on its side on the cloud. Eyes close, limbs tuck in, the tail moves slowly, and sleep marks rise beside the head.
