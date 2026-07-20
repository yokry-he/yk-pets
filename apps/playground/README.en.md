# NOVA Playground

`apps/playground` is a 3D cloud-fox demo and page-audit lab built with Nuxt 4, Vue 3, TresJS, Pinia, XState, and GSAP. It validates pet presentation, state-machine behavior, and interaction ideas; it does not maintain a product version separate from the browser extension.

## Implemented features

- procedural 3D cloud fox without an external model;
- pointer gaze, blinking, breathing, greeting, jumping, flapping, resting, sleeping, and randomized motions;
- speaking mouth movement, happy expressions, confused expressions, and motion recovery;
- XState pet-behavior state machine;
- Pinia persistence for theme, affection, interaction count, and easter-egg state;
- VueUse awareness for idleness, visibility, pointer position, and viewport size;
- Nuxt Server API;
- optional OpenAI Responses API with a local Mock Agent when no key is configured;
- `/audit-lab` for extension audit and network regression.

## Requirements

- Node.js 22 or later;
- Corepack and the repository-pinned pnpm version.

## Start

Run from the repository root:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev:playground
```

Default test pages:

```text
http://localhost:3000
http://localhost:3000/audit-lab
```

## Validation

```bash
pnpm --filter @nova/playground typecheck
pnpm build:playground
```

The current baseline passes type checking and production build. The Three.js/TresJS 3D chunk may exceed 500 KB and produce a warning, but it is loaded asynchronously and does not enter the page-audit Content Script.

## Enable the real AI service

Prepare an environment file under `apps/playground`:

```bash
cp .env.example .env
```

```env
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-5.6-luna
```

The API key is read only by the Nuxt server and is never exposed to the browser.

## Key directories

```text
app/
├── components/pet/       # 3D scene and cloud fox
├── components/ui/        # Chat panel
├── machines/             # XState state machine
├── stores/               # Pinia persistence
├── types/                # Shared frontend types
└── pages/                # Demo and audit-lab pages
server/api/               # AI command endpoint
public/models/            # Optional GLB models
```

## Motion and state protocol

The Playground `PetAnimation` type, XState events, and server Schema must remain aligned. The main states include:

```text
idle
speaking
happy
thinking
sleeping
greeting
jumping
flapping
resting
```

`app/pages/index.vue` passes state to `PetCanvas.vue`, which passes it to `CloudFox.vue`. A completed motion must return to a stable state without leaving paws, gaze, or body posture at an intermediate value.

## Common problem: blank 3D canvas

Nuxt nested-component auto-import names may include directory prefixes, while TresJS may interpret unresolved tags as Three.js objects. Nested components should be imported explicitly in `PetCanvas.vue` and page components, for example:

```ts
import CloudFox from './CloudFox.vue'
import ChatDock from '~/components/ui/ChatDock.vue'
```

When you see `CloudFox is not defined in THREE namespace`, `Failed to resolve component`, or `target is not a constructor`:

```bash
rm -rf apps/playground/.nuxt
pnpm dev:playground
```

Also verify that the affected nested components are imported explicitly.

## Replace the procedural pet with a production GLB model

1. Put `pet.glb` in `public/models/`;
2. create a component using TresJS model-loading capabilities;
3. preserve the existing `behavior`, `emotion`, `pointer`, and `secret-mode` inputs;
4. map states to AnimationMixer clips and Blend Shapes;
5. keep the page layer, Pinia, XState, and AI command protocol.

## Commands to try

- `What can you do?`
- `Switch the theme.`
- `Give me a greeting.`
- `Jump.`
- `Flap your front paws.`
- `Lie down and rest.`
- `Go to sleep.`
- `Wake up.`
