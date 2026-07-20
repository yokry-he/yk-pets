# YK-PETS Roadmap

## Current identity

```text
Product brand: YK-PETS
Default pet: Zeph / 云灵
Default species: Cloud Fox / 云狐
```

## 0.6.10 Brand and identity migration

- Rebrand the extension, Side Panel, CLI, and primary documentation as YK-PETS.
- Model product brand, pet name, and pet species separately.
- Add `PetIdentity` and `ZEPH_CLOUD_FOX_IDENTITY`.
- Introduce canonical `YkPet*` and `YkPets*` domain types.
- Migrate `nova:*` settings to `yk-pets:*` with bidirectional mirroring.
- Migrate `.nova/agent.json` to `.yk-pets/agent.json`.
- Make `yk-pets-agent` the primary CLI while keeping a compatibility alias.
- Add a brand-and-identity regression gate.

## 0.7 Pet core runtime

- Extract framework-independent pet state, events, and lifecycle.
- Extract motion priority, interruption, queueing, and idle scheduling.
- Separate generic intents from concrete animation IDs.
- Define `PetDefinition`, capability declarations, and motion fallbacks.
- Convert Zeph into the first registered pet definition.
- Stop extending generic core protocols with Cloud-Fox-specific assumptions.

## 0.8 Multi-pet registry

- Implement a pet registry and lazy asset loading.
- Add a second real pet as an architecture acceptance test.
- Support multiple named pets of the same species and personality profiles.
- Support pet selection, switching, and persistence.
- Allow independent themes, motions, voices, and 2D fallbacks.
- Preserve audit, network, and Agent state while switching pets.

## 0.9 Cross-stack Web SDK

- Provide a plain JavaScript `createYkPet()` API.
- Provide a `<yk-pet>` Web Component.
- Support ESM, lazy loading, and framework-free usage.
- Add React, Vue, Nuxt, Next.js, Svelte, and Astro examples.
- Keep framework adapters thin; they must not duplicate core logic.
- Provide 2D fallback for unavailable WebGL and low-performance devices.

## 1.0 Product release

- Publish to the Chrome Web Store.
- Add formal Edge support and evaluate Firefox.
- Provide a Native Messaging desktop Agent.
- Stabilize SDK lifecycle and semantic versioning.
- Define a pet asset-package format and third-party pet documentation.
- Add team policy, audit logs, and permission governance.
- Remove NOVA compatibility aliases after the migration window closes.

## Platform acceptance criteria

YK-PETS is considered a multi-pet platform only when:

1. Zeph is no longer hard-coded into the generic core.
2. At least two pets run through the same registration protocol.
3. A Web Component works without a Vue or React host.
4. Switching pets does not reset audit, network, or Agent state.
5. A new pet can be added without editing a generic motion union.
6. Existing `v0.6.10` user data upgrades safely.
