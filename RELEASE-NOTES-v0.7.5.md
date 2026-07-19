# YK Pets v0.7.5

## Added

- `@yk-pets/pet-devtools-bridge`: read-only, origin-bound CDP inspection with budgets, timeouts, redaction, and event buffering.
- `@yk-pets/pet-source-mapper`: stable DOM selectors, Vue 2/3 ownership, inspector metadata, and Source Map v3 resolution.
- `@yk-pets/pet-verification-runner`: adapter-driven Lighthouse and declarative Playwright before/after verification.
- `@yk-pets/pet-change-report`: deterministic `yk-pets.change-report/v1` JSON and Markdown reports.
- Lazy `deep-analysis` loading and the controlled `analysis:run` extension runtime command.

## Security

The default CDP bridge permanently denies arbitrary script evaluation, DOM mutation, input synthesis, cross-origin navigation, cookies, response bodies, downloads, and script injection. Playwright scenarios are declarative and do not expose an evaluate step.

## Compatibility

- Platform version: `0.7.5`
- Browser extension stable baseline: `0.6.10` unchanged
- Node.js: `>=22` for the workspace release gate; published runtime packages remain compatible with their declared engines.
