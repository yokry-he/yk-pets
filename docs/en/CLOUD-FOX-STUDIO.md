# Cloud Fox Studio

## 1. Goal

Cloud Fox Studio is the first pet appearance authoring tool in YK-PETS. It starts from a species template and lets users create a Cloud Fox individual without breaking motion compatibility or runtime performance.

Current default individual:

- name: Zeph / 云灵;
- pet ID: `zeph`;
- species: Cloud Fox / 云狐;
- species ID: `cloud-fox`.

The product brand, pet name, and species are separate concepts. Changing appearance does not change identity, affection, or future memory data.

## 2. Entry point

Start the Playground:

```bash
pnpm dev:playground
```

Open:

```text
http://localhost:3000/studio
```

Other Playground pages also expose a Cloud Fox Studio shortcut in the bottom-right corner.

## 3. Appearance recipe

Appearance is stored as a `CloudFoxAppearanceRecipe`, not as a serialized Three.js scene. The recipe contains:

- identity: pet ID, Chinese and English names, monogram;
- parts: ears, eyes, nose, mouth, tail, antennae;
- proportions: body, head, front limbs, paws, eyes, ears, tail, and antennae;
- colors: coat regions, eye color, and independent glow channels;
- glow: fixed, behavior-linked, or rainbow modes;
- symbols: chest text, back text, size, and glow color.

The current schema uses:

```text
schemaVersion: 1
speciesId: cloud-fox
```

Imported or incomplete JSON is normalized. Unknown parts fall back to defaults and proportions are clamped to the species safe ranges.

## 4. Part slots

### 4.1 Ears

- Nebula Point;
- Soft Round;
- Wing Ear;
- Mecha Ear.

### 4.2 Eyes

- Round;
- Oval;
- Spark;
- Visor.

### 4.3 Nose and mouth

Noses support Soft Nose, Fox Triangle, and Sensor. Mouths support Smile, Cat Mouth, and Quiet Line.

### 4.4 Tail

- Cloud Tail;
- Plume Tail;
- Long Tail;
- Energy Tail.

### 4.5 Antennae

- None;
- Twin Star;
- Arc Light;
- Crystal.

## 5. Proportion safety ranges

Limbs and body parts do not expose unrestricted bone dragging. They use constrained parameters:

| Parameter | Minimum | Maximum |
|---|---:|---:|
| Body scale | 0.82 | 1.18 |
| Head scale | 0.84 | 1.20 |
| Front-limb length | 0.78 | 1.22 |
| Front-limb spacing | 0.82 | 1.20 |
| Paw scale | 0.76 | 1.32 |
| Ear scale | 0.76 | 1.28 |
| Eye scale | 0.76 | 1.32 |
| Eye spacing | 0.82 | 1.18 |
| Tail length | 0.78 | 1.34 |
| Tail width | 0.76 | 1.32 |
| Antenna scale | 0.72 | 1.36 |

These ranges belong to the species definition. Future species may expose different editable slots and limits.

## 6. Glow channels

The recipe currently provides:

- `primaryGlow`;
- `secondaryGlow`;
- `tailGlow`;
- `antennaGlow`;
- `symbolGlow`.

Glow modes:

- `fixed`: user-selected colors;
- `emotion`: colors react to idle, greeting, jumping, stretching, spinning, and resting;
- `rainbow`: hue cycles at runtime.

The renderer avoids full-screen Bloom post-processing so that a future in-page pet does not impose a large rendering cost on host pages.

## 7. Chest and back symbols

Defaults:

- chest: English-name monogram `Z`;
- back: brand shorthand `YK`.

Text is drawn into a transparent Canvas texture and placed on predefined body surfaces. Users can change one to three characters without generating new font geometry.

## 8. Editing and validation

Studio supports:

- front, left, back, and right views;
- dark, light, and simulated web-page backgrounds;
- idle, greeting, jumping, stretching, spinning, and resting motion tests;
- browser-local save;
- reset;
- random generation;
- JSON import and export.

After adjusting limbs, tail, or antennae, run all motion tests and check:

- limbs do not enter the body;
- paws do not float or visibly intersect;
- the tail does not pass through the body or platform;
- antennae do not intersect ears;
- chest and back symbols remain readable in their corresponding views.

## 9. Current implementation and boundary

Cloud Fox Studio has evolved from an isolated MVP into the Appearance workspace of the unified Pet Studio:

- Playground and extension reuse the sole production Cloud Fox composition, and versioned appearance recipes synchronize to the extension runtime;
- species, recipe envelopes, renderer registration, and motion domains live in framework-neutral `pet-core`;
- front and hind paws support constrained left/right-independent configuration;
- motion and props are edited in `/studio/motion` and `/studio/props` while remaining independent from appearance assets;
- the Prop workspace supports constrained safe local GLB, but Appearance does not accept arbitrary model replacement;
- multi-tail pets, community part packs, true model raycasting, and a three-axis 3D gizmo are not implemented.

See [Unified Studio workspaces](./STUDIO-WORKSPACES.md) and [Current project status](./PROJECT-STATUS.md).
