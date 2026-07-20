# NOVA Browser Agent v0.6.0 Validation Report

## 1. Scope

This report covers:

- Curated high-altitude randomized fireworks.
- Dual antennae and brighter tail-tip glow.
- Shy Peek, Star Juggling, Cloud Nap, and Sparkle Sneeze.
- Four-tier idle/easter scheduling.
- Per-request expandable Network Lab details.
- Fetch/XHR request headers, response headers, and request-body capture.
- Page synchronization after manual and request-based rule creation.
- Chrome Manifest V3 production build and ZIP.

## 2. Source and documentation gates

Passed:

- Bilingual documentation and code-comment gate.
- v0.5.2 responsibility-header gate.
- v0.6.0 feature checks: 15/15.
- Network Lab regression checks: 19/19.
- Mock Workbench/high-energy checks: 19/19.
- Network domain tests: 15 assertions.
- Network workbench tests: 18 assertions.

## 3. Type checks

Passed:

- `packages/shared` TypeScript.
- WXT type generation.
- Vue `vue-tsc --noEmit`.

## 4. Production build

Executed:

```bash
rm -rf apps/extension/.output apps/extension/.wxt
wxt prepare
vue-tsc --noEmit
wxt build -b chrome
wxt zip -b chrome
```

Results:

- WXT: `0.20.27`.
- Chrome Manifest V3.
- Manifest version: `0.6.0`.
- Production build passed.
- WXT ZIP packaging passed.
- Every production JavaScript file passed `node --check`.
- ZIP integrity test passed.

Chrome package SHA-256:

```text
4e34ae8186b9e560ddefe30a83087f31c6ccdb4738c2dcd97fd5bfb479e43510
```

## 5. Feature results

### Pet vitality

- Five new behaviors are present in the shared protocol.
- Five motions are present in the registry and paginated menu.
- Fireworks contain three consecutive launches.
- The shape pool contains spherical/chrysanthemum, ring, heart, and star patterns.
- Colors use four curated palettes.
- Fireworks use widened camera framing.
- Tail-tip emissive intensity was increased.
- Dual antennae, energy beads, charge motion, and strong-glow linkage are present in production code.
- Normal, rare, high, and easter scheduling tiers are connected.
- Reduced-motion fallback remains supported.

### Network Lab

- Each request row can expand and collapse.
- Details include query parameters, timing, request/response headers, and payload previews.
- Sensitive headers and object keys are redacted before cross-world transfer.
- Saving, removing, or toggling a rule synchronizes the page and consumes the returned snapshot.
- Manual nonexistent-endpoint rules and request-generated rules share one editor.

## 6. Validation not automated

The container did not provide a reliable real-site visual browser regression, so installation-time manual checks are still required for:

- Firework framing at different pet positions and window sizes.
- Actual antenna-to-ear spacing.
- Visual quality and density of each firework shape.
- Compatibility of Fetch/XHR wrappers with the target business application.

Source gates, type checks, domain tests, production build, production JavaScript syntax, and ZIP integrity all passed.
