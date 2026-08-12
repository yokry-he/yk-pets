# Side Panel Task Workspace Manual Acceptance

## Navigation and Home

- Open the Side Panel and confirm Home, Memory, Audit, Network, and Zeph navigation.
- Confirm Home shows the active page title and URL.
- Create a current-page memory and verify the Home count updates without reloading the extension.
- Run Page Audit and verify the score and issue count appear on Home.
- Connect and disconnect the Local Agent and verify the Home state changes.
- Activate the four main Home actions and confirm they reuse the existing workspace or audit flow.

## Zeph workspace

- Confirm voice, 3D loading, idle motions, Pet Studio, and appearance import are grouped under Zeph.
- Verify these controls no longer block Memory, Audit, or Network Lab.
- Confirm moved buttons, inputs, voice preview, recipe import, and switches still work.
- Change settings, reload the Side Panel, and verify local persistence remains intact.

## Safety and non-interference

- Audit patch generation must still require the existing Local Agent connection and token.
- Network Lab rules, mocks, and request analysis must remain intact.
- Repeated Side Panel opens must not accumulate tab, runtime, storage, or MutationObserver listeners.
- Confirm there is no timer polling, additional upload, or new permission in DevTools.
- Verify narrow layouts, keyboard Tab/Enter/Space, and reduced-motion mode.
