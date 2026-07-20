# YK-PETS Playground

`apps/playground` is a 3D pet demo and page-audit lab built with Nuxt 4, Vue 3, TresJS, Pinia, XState, and GSAP.

Current demo identity:

```text
Product brand: YK-PETS
Pet name: Zeph / 云灵
Pet species: Cloud Fox / 云狐
```

The Playground validates pet presentation, state-machine behavior, interactions, and the future multi-pet SDK. It does not maintain a product version separate from the browser extension.

## Implemented features

- procedural 3D Cloud Fox without an external model;
- pointer gaze, blinking, breathing, greeting, jumping, flapping, resting, sleeping, and randomized motions;
- speaking mouth movement, happy and confused expressions, and motion recovery;
- XState pet-behavior state machine;
- Pinia state storage;
- GSAP motion and interface animation;
- page-audit laboratory;
- a YK-PETS client branding bridge for legacy NOVA wording in existing demo components.

## Run

From the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev:playground
```

The default URL is usually:

```text
http://localhost:3000
```

Audit laboratory:

```text
http://localhost:3000/audit-lab
```

## Brand and identity constraints

- YK-PETS is the product brand, not the pet's name.
- Zeph is the current pet name; 云灵 is the Chinese name.
- Cloud Fox is the species; 云狐 is the Chinese species name.
- New pets must register stable IDs, species, names, and capabilities.
- The Playground's long-term purpose is to prove that one runtime can load multiple pets instead of keeping Zeph hard-coded in the generic core.

## Future validation

- framework-independent `pet-core` state and motion scheduling;
- Zeph as the first `PetDefinition`;
- a second pet and capability fallbacks;
- the `<yk-pet>` Web Component;
- Vanilla, React, Vue, Svelte, and Astro integration examples.
