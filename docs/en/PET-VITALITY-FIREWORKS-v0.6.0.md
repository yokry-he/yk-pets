# NOVA v0.6.0: Pet Vitality, Fireworks, and Random Easter Eggs

## 1. Release goal

v0.6.0 upgrades NOVA from a menu-driven animated 3D pet into a digital companion with lifestyle states, curated show motions, and low-probability easter eggs. The runtime follows these rules:

- Never cover primary page content or controls unnecessarily.
- High-energy effects are primarily user-triggered.
- Automatic easter eggs have a separate long cooldown and a low probability gate.
- Automatic playback pauses while the tab is hidden, the menu is open, the Agent is busy, or reduced motion is enabled.
- Motions remain registry-driven and use the shared behavior protocol.

## 2. Tail-tip and antenna energy system

### 2.1 Tail-tip glow

The tail tip uses three visual layers:

1. A brighter emissive tail segment.
2. A spherical energy core with a breathing pulse.
3. A soft outer glow, short trail, and low-count stardust.

Idle glow remains restrained. High-energy motions, fireworks, and energy bursts increase intensity, while resting and cloud-nap states reduce particles.

### 2.2 Dual antennae

Two curved energy antennae are attached to the head. Each antenna ends in an emissive energy bead.

- Idle: low-amplitude elastic motion.
- Thinking: regular pulse.
- Star juggling: medium glow.
- Sparkle sneeze: charge followed by a brief flash.
- Fireworks: sustained launch glow.
- Energy burst: antennae, tail tip, and chest core charge together.

## 3. New motions

### 3.1 Shy peek

The pet tilts its body, raises both paws toward the cheeks, increases blush, looks sideways, and smoothly returns to idle. It is available as both a menu action and a normal idle motion.

### 3.2 Star juggling

Three energy stars circulate between the paws and tail area. The head and eyes track the active high point while the forearms alternate catches. Duration is approximately 6.4 seconds.

### 3.3 Cloud nap

NOVA summons a softly glowing cloud, lowers the body, tucks its paws, closes its eyes, and switches the antennae to a slow breathing glow. The cloud and sleep marks drift gently for about 7.6 seconds.

### 3.4 Sparkle sneeze

The antennae quickly charge, NOVA briefly holds a sneeze, then releases a small starburst from the nose. Particle count and duration remain deliberately low. It belongs to the easter-egg pool.

### 3.5 High-altitude fireworks show

The fireworks show contains three consecutive launches:

1. NOVA alternates raised paws.
2. An energy rocket travels to the top of the scene.
3. The rocket bursts at high altitude.
4. The head and eyes stay focused upward.
5. Antennae, tail tip, and chest core brighten together.

Each burst selects one curated shape:

- Chrysanthemum/spherical.
- Ring.
- Heart.
- Star.

Colors are selected only from curated blue-purple, gold-pink, mint-cyan, and pink-violet palettes. The camera widens during this motion so the burst is clearly above the pet.

## 4. Random easter-egg scheduling

Automatic motions now use four tiers:

| Tier | Approximate interval | Content |
|---|---:|---|
| normal | 25–45 seconds | Wave, jump, shy peek, and similar motions |
| rare | 60–120 seconds | Ball play, eating, star juggling, cloud nap |
| high | 180–300 seconds plus probability gate | Backflip, tail tornado, diving catch, energy burst |
| easter | 240–420 seconds with about a 28% pass rate | Sparkle sneeze and fireworks show |

A motion restarts its tier cooldown after playback, and the same automatic behavior is not selected twice in a row.

## 5. Reduced motion

When `prefers-reduced-motion: reduce` is active:

- Firework expansion radius is reduced.
- High-energy displacement and rotation are reduced.
- Automatic motion scheduling is disabled.
- Manual motion selection remains available with simplified movement.

## 6. Adding another motion

A new behavior must update:

1. `NovaPetBehavior` in `packages/shared/src/messages.ts`.
2. The registry in `pet-motions.ts`.
3. Duration, flags, rig animation, and props in `CloudFox.vue`.
4. Idle tier and bilingual documentation.
5. The v0.6.0 feature validation script.
