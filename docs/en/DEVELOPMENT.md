# Development and Runtime Guide

## Environment

- Node.js 22+
- pnpm 11+
- Chrome or Edge with Manifest V3 Side Panel support

## Installation

```bash
corepack enable
pnpm install
```

## Run the three components

Terminal 1, start the Nuxt Playground:

```bash
pnpm dev:playground
```

Open:

```text
http://localhost:3000/audit-lab
```

Terminal 2, start the Local Agent:

```bash
pnpm dev:agent
```

The terminal displays:

```text
Address: ws://127.0.0.1:4736
Connection token: <token>
```

Terminal 3, start the extension development build:

```bash
pnpm dev:extension
```

## Load the extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click “Load unpacked.”
4. Select:

```text
apps/extension/.output/chrome-mv3
```

5. Refresh the target page after installing or reloading the extension.
6. Refresh the page and wait for the 3D NOVA fox to appear in the bottom-right corner. The toolbar icon can still open the Side Panel.

## Validate the complete workflow

### Animal-only workflow

1. Open `/audit-lab` and wait for the in-page 3D NOVA fox.
2. Double-click the fox and confirm that a page audit starts.
3. Single-click the fox, open quick actions, and use “Next” to navigate findings.
4. Confirm that the page scrolls to the affected element and the location label does not cover its content.
5. Click “Preview fix,” verify the temporary DOM change, then click again to undo it.
6. Right-click the fox to open the engineering toolbox.
7. Click “Connect Local Agent,” then enter the CLI URL and token in the Side Panel.
8. Return to the fox toolbox and click “Generate source patch for current issue.”
9. Review the diff for `app/pages/audit-lab.vue` in the Side Panel.
10. Trigger “Confirm current patch write” from the fox.
11. Trigger “Run Typecheck / Test / Build” from the fox.
12. Trigger “Roll back latest patch” from the fox when needed.

### Interaction regression checks

- Single-click: expand/collapse the menu.
- Double-click: run an audit.
- Right-click: expand the engineering toolbox.
- Hover: play a greeting and follow the pointer.
- Drag: reposition the fox without leaving the viewport.
- Keyboard: reach every menu action with Tab and activate it with Enter.
- Narrow viewport: menus introduce no page-level horizontal scrolling.

## Quality checks

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm build:playground
```

## Production packaging

```bash
pnpm zip:extension
pnpm build:agent
```

The extension ZIP is generated in WXT's `.output` directory. The Local Agent build is generated in:

```text
packages/local-agent/dist
```

## Troubleshooting

### The 3D NOVA fox does not appear in the bottom-right corner

Confirm that the target is a normal `http://` or `https://` page, then refresh the tab after installing or reloading the extension. Chrome internal pages and the extension store do not allow injection.

### The Side Panel cannot connect to the page

Tabs that were already open before an extension install or reload do not automatically receive the latest Content Script. Refresh the target page.

### The Local Agent cannot be reached

Confirm that:

- The CLI process is still running.
- The URL uses `ws://127.0.0.1:<port>`.
- The token matches the value printed in the terminal.
- The test is not running on a restricted page such as `chrome://` or the extension store.

### Only candidate files are shown and no automatic patch is available

The source mapping or repair rule is not reliable enough. Add a stable `id` or `data-testid`, preserve the resource file name, or inspect the candidate file manually.

## Code-comment standard

Explanatory code comments use the bilingual format “中文 / English.” Comments should explain intent, boundaries, or non-obvious reasons rather than restating the code.

Single-line comment:

```ts
// 校验文件哈希，避免覆盖并发修改。 / Verify the file hash to avoid overwriting concurrent edits.
```

Template comment:

```vue
<!-- 浮空底座 / Floating platform -->
```

Block comment:

```ts
/**
 * 仅允许执行预定义的项目脚本。
 * Only predefined project scripts may be executed.
 */
```

Whenever a comment is added or changed, both languages must be updated and remain semantically equivalent.
## Animal action contract check

```bash
pnpm check:pet-actions
```

This command ensures every `NovaPetAction` is present in the shared protocol, the in-page animal entry point, and the corresponding Content Script or Side Panel handler. `pnpm typecheck` includes this check automatically.

