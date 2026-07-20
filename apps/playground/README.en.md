# YK-PETS Playground

`apps/playground` is a 3D pet demo, Cloud Fox Studio, and page-audit lab built with Nuxt 4, Vue 3, TresJS, Pinia, XState, and GSAP.

Current demo identity:

```text
Product brand: YK-PETS
Pet name: Zeph / 云灵
Pet species: Cloud Fox / 云狐
```

The Playground validates pet presentation, state-machine behavior, appearance recipes, interactions, and the future multi-pet SDK. It does not maintain a product version separate from the browser extension.

## Implemented features

- procedural 3D Cloud Fox without an external model;
- pointer gaze, blinking, breathing, greeting, jumping, flapping, resting, sleeping, and randomized motions;
- speaking mouth movement, happy and confused expressions, and motion recovery;
- XState pet-behavior state machine;
- Pinia state storage;
- GSAP motion and interface animation;
- page-audit laboratory;
- Cloud Fox Studio with part selection, constrained proportions, glow, chest/back symbols, motion tests, and JSON recipe management;
- a YK-PETS client branding bridge for legacy NOVA wording in existing demo components.

## Run

From the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev:playground
```

Home page:

```text
http://localhost:3000
```

Cloud Fox Studio:

```text
http://localhost:3000/studio
```

Audit laboratory:

```text
http://localhost:3000/audit-lab
```

## Cloud Fox Studio

The Studio currently supports:

- ear, eye, nose, mouth, tail, and antenna styles;
- safe proportions for the body, head, front limbs, paws, eyes, ears, tail, and antennae;
- coat colors, eye color, and five glow channels;
- fixed, behavior-linked, and rainbow glow modes;
- a chest monogram and back `YK` mark;
- four views, three backgrounds, and six motion tests;
- local save, reset, random generation, JSON import, and JSON export.

See [`docs/en/CLOUD-FOX-STUDIO.md`](../../docs/en/CLOUD-FOX-STUDIO.md) for the full design and data model.

## Brand and identity constraints

- YK-PETS is the product brand, not the pet's name.
- Zeph is the current pet name; 云灵 is the Chinese name.
- Cloud Fox is the species; 云狐 is the Chinese species name.
- New pets must register stable IDs, species, names, and capabilities.
- Appearance recipes are separate from individual state, so changing appearance does not copy affection or memory.
- The Playground's long-term purpose is to prove that one runtime can load multiple pets instead of keeping Zeph hard-coded in the generic core.

## Future validation

- connect Cloud Fox Studio recipes to the extension pet;
- framework-independent `pet-core` state and motion scheduling;
- Zeph as the first `PetDefinition`;
- a second pet and capability fallbacks;
- the `<yk-pet>` Web Component;
- Vanilla, React, Vue, Svelte, and Astro integration examples.
