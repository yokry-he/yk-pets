# NOVA Browser Agent v0.6.6 Validation Report

## Core scenarios

- Captured JSON produces both a lightweight preview and a complete editable body up to 512 KB.
- Request-derived rules prefer the complete body.
- Modify Real Response displays the whole JSON document without field-path controls.
- Saved rules contain `replacementBody` and no new field transforms.
- Fetch and XHR both replace the complete body while preserving real response metadata.

## Results

- v0.6.6 whole-JSON response checks: 11/11.
- The whole-JSON editor runtime regression passes.
- Network Domain: 22 assertions pass; Network Workbench: 18 assertions pass.
- Extension, Shared, Local Agent, and Playground type checks pass.
- Local Agent: two tests pass.
- Extension and Local Agent production builds pass.

## Post-install confirmation

Reload v0.6.6 and refresh the target page. Trigger the request again so NOVA can capture the complete real JSON; existing request records are not backfilled automatically.
