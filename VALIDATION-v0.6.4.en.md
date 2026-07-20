# NOVA Browser Agent v0.6.4 Validation Report

## Reproduction and fix

- The regression builds parent-component reactive state with nested Vue proxies matching the Side Panel path.
- Native `structuredClone` is first proven to throw `could not be cloned` for that input.
- After the fix, both manual and request-derived creation open the editor and build saveable rules.
- Network Lab TypeScript and Vue business source contains no direct `structuredClone` call.

## Results

- v0.6.4 rule-proxy checks: 5/5.
- v0.6.4 motion, audio, bubble, and rule regression: 16/16.
- v0.6.4 interaction and Mock entry-point checks: 13/13.
- Network Domain: 15 assertions pass.
- Network Workbench: 18 assertions pass.
- Extension, Shared, Local Agent, and Playground type checks pass.
- Local Agent: two tests pass.
- Extension and Local Agent production builds pass.

## Artifact confirmation

- Chrome Manifest version: `0.6.4`.
- Side Panel footer version: `NOVA 0.6.4`.
- Extension output is about 1.27 MB; the ZIP is about 370 KB.

## Post-install confirmation

Reload v0.6.4 from `chrome://extensions`, close and reopen the Side Panel, and refresh the target page. Confirm the footer says `NOVA 0.6.4` before testing Create Rule.
