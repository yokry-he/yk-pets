# NOVA Motion Upgrade v1.2.0

## New visual behavior

- The mouth opens and closes continuously while NOVA speaks, based on reply duration.
- Happy, greeting, jumping, and flapping states use smiling eyes and cheek blush.
- The confused state adds asymmetric eyes, a head tilt, and an angled mouth.
- A one-shot jump includes anticipation, airborne stretch, and landing compression.
- Front-paw flapping coordinates the body, ears, tail, and energy core.
- A lying-down state lowers the body, leans the head forward, and stretches the front paws.
- Front-paw baseline coordinates were corrected so the paws do not drift toward the body center after an animation.
- An in-canvas action toolbar now provides greeting, jump, flap, and rest actions.
- The conversation Agent supports the structured animation commands `jumping`, `flapping`, and `resting`.

## Test phrases

```text
Say hello to me
Jump
Flap your front paws
Lie down and rest
Listen carefully
Spin around
```

## Main modified files

- `app/components/pet/CloudFox.vue`
- `app/components/pet/PetCanvas.vue`
- `app/pages/index.vue`
- `app/machines/pet.machine.ts`
- `app/types/pet.ts`
- `app/components/ui/ChatDock.vue`
- `app/assets/css/main.css`
- `server/api/pet-command.post.ts`

## Validation note

The original motion-upgrade environment completed syntax parsing only. The current Monorepo has since passed `pnpm typecheck` and `pnpm build:playground`. The motion upgrade did not change the lockfile or dependency versions.
