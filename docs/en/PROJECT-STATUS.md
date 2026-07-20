# YK-PETS Current Project Status

## Current baseline

- Stable reference: `v0.6.10`;
- Development branch: `agent/yk-pets-rebrand-v0610`;
- Product brand: `YK-PETS`;
- Current default pet: Zeph（云灵）;
- Current species: Cloud Fox（云狐）;
- Primary deliverables: Chrome/Edge Manifest V3 extension and local WebSocket Agent;
- Current phase: brand migration, explicit pet identity modeling, and preparation for a multi-pet platform.

## Completed brand migration

- The extension manifest, browser action, Side Panel title, primary CLI, and main documentation use YK-PETS.
- The root package is named `yk-pets`.
- The primary Local Agent command is `yk-pets-agent`.
- The new configuration directory is `.yk-pets/`.
- `PetIdentity` stores pet ID, species ID, localized species names, and localized pet names separately.
- The default identity is `ZEPH_CLOUD_FOX_IDENTITY`.
- New domain types use `YkPet*` and `YkPets*` names.
- A brand-and-identity regression gate is part of the root typecheck workflow.

## v0.6.10 compatibility policy

The following legacy technical identifiers remain temporarily to avoid breaking upgrades:

- deprecated `Nova*` type aliases;
- existing `NOVA_*` wire-message values;
- the private `@nova/*` workspace scope;
- bidirectional mirroring between `nova:*` and `yk-pets:*` storage keys;
- migration from `.nova/agent.json` to `.yk-pets/agent.json`;
- the `nova-agent` command alias.

They exist only for compatibility. User-facing UI and new features must not use NOVA as the product brand or pet name.

## Current engineering principles

- Product brand, pet species, and pet name are separate domain concepts.
- The domain layer must not depend on Vue, Chrome APIs, the DOM, or a concrete Agent provider.
- Fixes must cover the real runtime path rather than only changing presentation.
- Existing rules, messages, and local data must remain backward compatible.
- Reloading a page, extension, or Side Panel must produce predictable state.
- New pets must register capabilities instead of adding species-specific assumptions to the generic core.

## Stable capabilities

- a procedural 3D Cloud Fox named Zeph with motions, dragging, menus, and voice presets;
- page audits, independently selectable rules, finding navigation, and reversible previews;
- Fetch/XHR capture, mocking, delay, and whole-JSON response replacement;
- token-authenticated local WebSocket Agent;
- SHA-256 concurrent-edit protection, explicit confirmation, verification, and rollback;
- workspace typechecks, focused regression scripts, and production builds.

## Next phase

1. Extract framework-independent pet state, events, motion scheduling, and idle behavior into `pet-core`.
2. Convert Zeph into the first `PetDefinition` rather than a hard-coded singleton.
3. Add a second real pet to validate registration and fallback behavior.
4. Provide a plain JavaScript API and a `<yk-pet>` Web Component.
5. Add thin React, Vue, and Svelte adapters after the core API is stable.
