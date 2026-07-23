# Pet Memory

Pet Memory is YK-PETS' local-first inbox for web context. It is not an isolated notes page: it connects ideas, selected text, audit findings, follow-up tasks, Zeph, and the Local Agent workflow.

## Entry points

Open Pet Memory through any of these paths:

- the **Pet Memory** workspace at the top of the Side Panel;
- **Features → Pet Memory** in the in-page pet menu;
- the Chrome shortcut: `Ctrl+Shift+.` on Windows/Linux or `Command+Shift+.` on macOS;
- select text and choose **Let Zeph remember this** from the context menu;
- right-click the page and choose **Record this page in Pet Memory**;
- choose **Remember** on an audit issue card.

The shortcut can be remapped at `chrome://extensions/shortcuts`.

## Quick capture

The composer automatically includes the current page title and URL. When it is opened from selected text, it also displays a quote preview.

A memory card can contain:

- a title and body;
- page title and URL;
- selected text;
- tags;
- low, medium, or high priority;
- inbox, todo, doing, done, or archived status;
- related audit issue, network request, or patch identifiers.

Press `Command/Ctrl + Enter` in the composer to save immediately.

## Workflow

The default flow is:

```text
Inbox → Todo → Done
```

- New captures enter the Inbox.
- **Add to Todo** turns a capture into a task.
- **Mark Done** triggers completion feedback from Zeph.
- Completed tasks can be restored to Todo.
- An archive action can be undone for six seconds.

The top-level views cover Inbox, Todo, Done, and Current Page. Search matches titles, content, source pages, and tags.

## 3D pet interaction

- Saving a memory triggers a greeting and confirmation from Zeph.
- Completing a task triggers a celebration response.
- When the current page has non-archived memories, a count badge appears on the in-page pet.
- Opening Pet Memory from the pet menu switches the Side Panel directly to that workspace.
- Saving selected text from the context menu produces immediate in-page confirmation.
- A JSON import produces one short completion response after the result is known.

These responses do not open large automatic overlays or change the host page layout.

## Relocating page excerpts

Cards with selected text display **Locate excerpt**. After an explicit click:

- the current tab is searched directly when it already matches the source page;
- otherwise the source page is opened by that user action before matching starts;
- an existing element selector narrows the first search when available; otherwise matching starts with the full page;
- an exact browser selection and a short-lived overlay highlight the result, while duplicate matches are reported;
- changed content, invalid source URLs, and missing visible matches produce clear failure states;
- scanning is bounded to 20,000 text nodes and about 2 MB of text and runs only after the click;
- the overlay is removed after 12 seconds without permanent DOM markers, polling, or upload.

Older cards without a selector still use their saved quote text. Imported or integration-created cards that already include a selector use it automatically.

## Turning audit findings into memories

Audit issue cards include a **Remember** action. The resulting memory card:

- uses the issue title and explanation;
- keeps the page URL and element selector;
- maps severity to priority;
- starts in Todo;
- adds Page Audit and category tags.

A later phase will connect these cards to source candidates, patches, and validation results.

## Import and export

The Pet Memory transfer menu supports:

- **Import JSON** for restoring or migrating YK-PETS v1 memory exports;
- **Export Markdown** for documents, issues, and task tools;
- **Export JSON** for local backup and migration.

JSON import uses a safe merge policy:

- existing memories are not cleared and cards with matching IDs are not overwritten;
- exact duplicates are skipped;
- matching IDs with different content are reported as conflicts and skipped;
- invalid cards, duplicates, conflicts, and capacity truncation are reported separately;
- both `{ "version": 1, "cards": [...] }` envelopes and direct card arrays are accepted;
- one import file can be up to 8 MB;
- the local 500-card boundary still applies, and cards beyond the available capacity are not written.

Default exports include non-archived memories. Import files are read only after explicit file selection and are never uploaded.

## Data and privacy

- Memory cards are stored in extension-owned `chrome.storage.local`.
- The current release requires no account and performs no upload or cloud sync.
- Selected text is read only after an explicit context-menu or quick-capture action.
- Saved page context is limited to the page title, HTTP/HTTPS URL, and text explicitly selected by the user.
- The implementation does not request `unlimitedStorage`.
- Up to 500 cards are retained, prioritizing non-archived content when the limit is reached.
- Removing the extension removes its browser-local data, so important memories should be exported first.

## Current limitations

- Page screenshots are not stored.
- Excerpts can be relocated on demand, but major page-text changes may prevent an exact match.
- Cloud sync and cross-device merging are not available.
- Ordinary memory cards cannot yet instruct the Local Agent to edit source code.
- JSON import does not overwrite conflicting cards or provide an interactive per-card conflict resolver.
