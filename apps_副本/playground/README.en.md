# Nuxt AI Pet

A 3D AI digital-pet MVP built with Nuxt 4, Vue 3, TresJS, Pinia, XState, and GSAP.

## Implemented features

- Procedural 3D cloud-fox pet that runs without an external model
- Mouse gaze tracking, blinking, breathing, jumping, thinking, sleeping, and hidden-mode animations
- XState pet-behavior state machine
- Pinia local persistence for theme, affection, interaction count, and hidden-mode state
- VueUse environment awareness for idleness, document visibility, mouse position, and window size
- GSAP hero and scroll animation
- Nuxt Server API
- Optional OpenAI Responses API with Structured Outputs
- Automatic local Mock AI when no API key is configured

## Requirements

- Node.js 22 or later
- pnpm is recommended; the repository includes a lockfile

## Start

```bash
corepack enable
pnpm install
pnpm dev
```

You may also use npm:

```bash
npm install
npm run dev
```

Open the local URL printed by the terminal.

## Verified commands

```bash
pnpm typecheck
pnpm build
```

Start the production output with:

```bash
node .output/server/index.mjs
```

## Enable the real AI service

```bash
cp .env.example .env
```

Set these values in `.env`:

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
└── pages/index.vue       # Main experience orchestration
server/api/               # AI command endpoint
```

## Replace the procedural pet with a production GLB model

The current `app/components/pet/CloudFox.vue` is assembled from Three.js geometries. To integrate a production model:

1. Put `pet.glb` in `public/models/`.
2. Create a GLB component using TresJS model-loading capabilities.
3. Preserve the component inputs `behavior`, `emotion`, `pointer`, and `secret-mode`.
4. Map states to AnimationMixer clips and Blend Shapes.
5. Keep the page layer, Pinia, XState, and AI command protocol; the business architecture does not need to be rewritten.

## Commands to try

- `What can you do?`
- `Switch the theme.`
- `Show me your true power.`
- `Go to sleep.`
- `Wake up.`

## v1.2.0 motion upgrade

This version adds speaking mouth movement, happy facial expressions, jumping, front-paw flapping, and lying-down behavior, plus an action toolbar inside the 3D panel. See [`MOTION_UPGRADE.md`](./MOTION_UPGRADE.md) for full details.
