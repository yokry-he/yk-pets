# Chrome Side Panel Task Workspace

## Information architecture

The Side Panel is organized around the current page with five primary workspaces:

- **Home**: current-page summary and frequent actions;
- **Memory**: Pet Memory inbox, tasks, and current-page memories;
- **Audit**: Page Audit, issue navigation, and the existing Local Agent patch entry;
- **Network**: Network Lab, rules, and mocking;
- **Zeph**: Pet Studio, appearance import, voice, 3D loading, and idle motions.

Pet instructions, voice, runtime settings, and Studio tools no longer occupy the top of every workspace. They are grouped under Zeph while preserving existing event handlers, storage, Local Agent, Network Lab, and recipe-import flows.

## Home

Home reads only the active tab and extension-local storage. It shows the current title and normalized URL, current-page memory count, total Todo/Doing count, latest audit score and issue count, and Local Agent connection state.

Actions start an audit, open Memory, enter Network Lab, configure Zeph, or open Agent settings by activating existing Side Panel controls rather than creating a new protocol.

## Lifecycle and privacy

- Updates come from tab events, `chrome.storage.onChanged`, runtime messages, and existing DOM state.
- There is no `setInterval` or background polling.
- Page content, memories, and recipes are not uploaded.
- No browser permission is added.
- MutationObservers and tab, runtime, and storage listeners are removed on page hide.
- Network Lab and Local Agent token, apply, check, and rollback boundaries remain unchanged.
