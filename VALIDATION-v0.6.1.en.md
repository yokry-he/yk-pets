# NOVA Browser Agent v0.6.1 Validation Report

## 1. Scope

This report covers:

- hover no longer interrupting primary motions;
- priority-aware single-item motion queue and settling transitions;
- more frequent idle scheduling;
- Curious Scan, Paw Tap, Antenna Charge, and Tail Glow Flow;
- antenna-to-head geometry connection;
- side-lying Cloud Nap;
- pet menu, fireworks, Network Lab, and Mock Workbench regressions;
- Chrome MV3 production build and archive integrity.

## 2. Automated checks

### Full workspace

Command:

```bash
pnpm typecheck
```

Result: passed.

Coverage includes:

- bilingual documentation and source-comment gates;
- v0.6.1 motion, glow, and sleep checks: 15/15;
- v0.6.0 vitality and network-detail checks: 15/15;
- motion-control and idle-scheduler checks: 19 items;
- menu, pagination, thought bubble, and lifestyle regressions;
- Network Lab regression: 19/19;
- Mock Workbench and high-energy regression: 19/19;
- Shared, Extension, Local Agent, and Playground TypeScript checks.

### Network domain tests

```bash
pnpm test:network-domain
pnpm test:network-workbench
```

Result: 15 and 18 assertions passed respectively.

## 3. Clean build

```bash
rm -rf apps/extension/.output apps/extension/.wxt
pnpm build:extension
pnpm zip:extension
```

WXT 0.20.27 Chrome MV3 build and ZIP packaging passed.

Manifest version: `0.6.1`.

Chrome package SHA-256:

```text
d18364ab63fb9c40ecc2d922c7fc476bf5dd380dd543b54807cafe1f744fcf2f
```

## 4. Production artifact checks

- every generated JavaScript file passed `node --check`;
- the production content script contains `curious-scan`, `paw-tap`, `antenna-charge`, `tail-glow`, and `cloud-nap`;
- the Chrome ZIP passed `unzip -t`;
- the v0.6.0 to v0.6.1 patch passed `patch --dry-run -p1`.

## 5. Visual checks not automated

The container does not provide a reliable real-page extension visual environment. The following items still require manual installation testing:

1. antenna roots remain attached at different browser zoom levels;
2. the side-lying body is centered naturally on the cloud;
3. Antenna Charge and Tail Glow Flow are not excessively bright on light pages;
4. the 260ms settling stage feels natural during consecutive motion input.
