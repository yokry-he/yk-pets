# NOVA Browser Agent v0.2.6 Validation Report

Release version: `0.2.6`

## Validation goals

v0.2.6 focuses on verifying that:

- the large status notice is hidden by default;
- it appears only for audit, preview, error, and Agent-task events;
- the notice can always be dismissed;
- full information is routed to the right-side Side Panel;
- manual motion buttons trigger 3D animations;
- repeated clicks on the same motion restart its timeline;
- the idle randomized motion carousel remains available;
- busy states, background tabs, and reduced-motion preferences pause idle playback.

## Automated checks

The following checks passed:

```text
bilingual documentation and code-comment check
11 animal-function contract checks
8 nebula and transparency checks
5 flexible-tail structure checks
13 motion-control and idle-carousel checks
11 on-demand notice and motion-restart checks
```

A new command is available:

```bash
pnpm check:notice-motion
```

It verifies that:

- `noticeOpen` defaults to `false`;
- notices are triggered by state changes;
- notices include a close control and a Side Panel details action;
- motion buttons call `runMotion`;
- `motionNonce` increments;
- `motionKey` reaches AvatarCanvas and CloudFox;
- CloudFox resets its animation timeline when `motionKey` changes.

## TypeScript and source syntax

TypeScript `transpileModule` syntax checks passed for the script sections of:

```text
NovaPetOverlay.vue
AvatarCanvas.vue
CloudFox.vue
content.ts
sidepanel/App.vue
```

CSS brace-balance checks also passed.

## Chrome runtime package checks

The loadable Chrome package passed deterministic checks for:

- Manifest version `0.2.6`;
- `v026-notice-motion-fix.js` injection;
- removal of the old `v025-motion-enhancement.js`;
- a `nova:motion` runtime bridge injected into the production `content.js`;
- motion scripts driving the compiled Vue `localBehavior` through `CustomEvent`;
- restoration of the default page-health behavior after a motion completes;
- notices hidden with `display: none` by default;
- important state changes temporarily opening the notice;
- close and Side Panel details controls inside the notice;
- all production JavaScript passing `node --check`.

## Build-environment limitation

The current environment could not resolve the npm registry. `pnpm install --frozen-lockfile` returned `EAI_AGAIN`, so a clean full WXT rebuild was not possible.

The supplied Chrome package starts from the previously compiled extension output and applies two deterministic changes:

1. a `nova:motion` event bridge is inserted into the compiled NOVA Overlay so motion controls can update its internal behavior state;
2. the v0.2.6 on-demand notice, motion menu, and idle-carousel runtime layer is added.

The modified Manifest, production JavaScript syntax, and ZIP integrity were checked. The complete Vue/WXT implementation is included in the source archive and can be rebuilt with `pnpm install && pnpm build:extension` in a network-enabled development environment.
