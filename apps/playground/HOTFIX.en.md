# Blank 3D Canvas Hotfix

## Cause

`CloudFox.vue` is located under `app/components/pet/`, while `PetCanvas.vue` used `<CloudFox />` without an explicit import.

Under Nuxt's nested-component auto-import naming rules, the generated component name may include a directory prefix. TresJS also handles unresolved tags. As a result, the browser treated `CloudFox` as a Three.js constructor and produced:

- `CloudFox is not defined in THREE namespace`
- `Failed to resolve component: CloudFox`
- `TypeError: target is not a constructor`

## Fix

Explicitly import the component in `app/components/pet/PetCanvas.vue`:

```ts
import CloudFox from './CloudFox.vue'
```

Also explicitly import the chat component in `app/pages/index.vue` to avoid the same nested-component naming issue:

```ts
import ChatDock from '~/components/ui/ChatDock.vue'
```

After the change, stop the old development server, delete the Nuxt cache, and restart:

```bash
rm -rf .nuxt
pnpm dev
```
