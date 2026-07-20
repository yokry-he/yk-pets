# YK-PETS Current Project Status

## Current baseline

- Stable reference: `v0.6.10`;
- Brand-migration branch: `agent/yk-pets-rebrand-v0610`;
- Cloud Fox Studio branch: `agent/cloud-fox-studio-v0610`;
- Product brand: `YK-PETS`;
- Current default pet: Zeph（云灵）;
- Current species: Cloud Fox（云狐）;
- Primary deliverables: Chrome/Edge Manifest V3 extension, local WebSocket Agent, and Playground Cloud Fox Studio;
- Current phase: Cloud Fox appearance recipes, constrained part editing, and live motion-validation MVP.

## Completed brand migration

- The extension manifest, browser action, Side Panel title, primary CLI, and main documentation use YK-PETS.
- The root package is named `yk-pets`.
- The primary Local Agent command is `yk-pets-agent`.
- The new configuration directory is `.yk-pets/`.
- `PetIdentity` stores pet ID, species ID, localized species names, and localized pet names separately.
- The default identity is `ZEPH_CLOUD_FOX_IDENTITY`.
- New domain types use `YkPet*` and `YkPets*` names.
- A brand-and-identity regression gate is part of the root typecheck workflow.

## Completed Cloud Fox Studio MVP

The Playground now provides `/studio` with:

- a versioned `CloudFoxAppearanceRecipe` using `schemaVersion: 1`;
- a Cloud Fox species definition, part slots, and proportion safe ranges;
- selectable ears, eyes, nose, mouth, tail, and antennae;
- constrained proportions for the body, head, front limbs, paws, eyes, ears, tail, and antennae;
- primary coat, shadow coat, belly, eye, and five glow-channel colors;
- fixed, behavior-linked, and rainbow glow modes;
- dynamic Canvas-texture chest monograms and back `YK` marks;
- front, left, back, and right views;
- dark, light, and simulated web-page backgrounds;
- idle, greeting, jumping, stretching, spinning, and resting motion tests;
- browser-local save, reset, random generation, JSON import, and JSON export;
- 21 Cloud Fox Studio contract checks and paired bilingual documentation gates.

The Studio renderer currently lives in the Playground and does not yet replace Zeph's production renderer in the extension.

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

- Product brand, pet species, pet name, and appearance recipe are separate domain concepts.
- Appearance recipes must not copy or overwrite affection, memory, or other individual state.
- Limbs and skeletons expose only constrained adjustments declared by the species.
- The domain layer must not depend on Vue, Chrome APIs, the DOM, or a concrete Agent provider.
- Fixes must cover the real runtime path rather than only changing presentation.
- Existing rules, messages, and local data must remain backward compatible.
- New pets must register capabilities instead of adding species-specific assumptions to the generic core.

## Stable capabilities

- a procedural 3D Cloud Fox named Zeph with motions, dragging, menus, and voice presets;
- Cloud Fox Studio appearance editing, live 3D previews, and motion validation;
- page audits, independently selectable rules, finding navigation, and reversible previews;
- Fetch/XHR capture, mocking, delay, and whole-JSON response replacement;
- token-authenticated local WebSocket Agent;
- SHA-256 concurrent-edit protection, explicit confirmation, verification, and rollback;
- workspace typechecks, focused regression scripts, and production builds.

## Next phase

1. Connect Cloud Fox Studio recipes to Zeph's production renderer in the extension.
2. Extract species definitions, appearance validation, and renderer interfaces into framework-independent packages.
3. Extract pet state, events, motion scheduling, and idle behavior into `pet-core`.
4. Add a second real species to validate part slots and capability fallbacks.
5. Provide a plain JavaScript API and a `<yk-pet>` Web Component.
6. Add thin React, Vue, and Svelte adapters after the core API is stable.
