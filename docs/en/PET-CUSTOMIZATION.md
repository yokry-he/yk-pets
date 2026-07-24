# Pet Customization System

## Batch scope

This phase adds one `customization` recipe layer for YK-PETS Zeph. Legacy Studio recipes, the extension classic appearance, and imported JSON are compatibility-normalized before entering the same Cloud Fox renderer.

## Nose and mouth

Nose and mouth choices are no longer recipe-only dropdown values with identical output. The unified head renders visibly different geometry for:

- noses: soft round, fox triangle, sensor, button, and heart;
- mouths: smile, cat, quiet line, happy open, and soft pout;
- talking, eating, happy, and sneeze motions continue to animate mouth opening;
- muzzle, nose, mouth, tongue, and cheek colors are independent.

## Belly patch

The default is now an explicit **ellipse**, rather than a hidden model-default mode that forces a shield.

Available silhouettes:

1. Ellipse
2. Egg
3. Shield
4. Teardrop
5. Inverted teardrop
6. Asymmetric bean
7. Rounded rectangle
8. Heart
9. Cloud
10. Chest fur

The belly supports visibility, color, width, height, horizontal and vertical position, rotation, and edge softness. Legacy `model-default` recipes migrate to an ellipse, while legacy custom shapes map to the nearest explicit name.

## All-part colors

The Studio Colors workspace covers every visible material channel in the current unified model:

- torso, limbs, and paws;
- muzzle, nose, mouth, tongue, and cheeks;
- eyes and highlights;
- outer ear, inner ear, and ear tip;
- antenna rod and tip;
- belly, tail glow, and energy core;
- primary and secondary orbits plus chest and back symbols.

To preserve the existing single model, torso also colors the tail root, limbs color the mid tail, and paws color the warm tail tip and antenna rod. These links are stated in the UI rather than presented as fake independent channels.

## Expanded ranges

Studio now uses expanded authoring ranges instead of treating the former safe range as a hard stop. Key ranges include:

- body width around `0.55–1.70`;
- body height around `0.55–1.72`;
- head scale around `0.68–1.48`;
- limb length around `0.42–1.38`;
- ear and eye scales around `0.52–1.72`;
- tail length around `0.50–1.90`;
- antenna scale around `0.42–1.82`;
- belly width and height around `0.42–1.72`.

The Audit workspace reports likely intersections outside the former recommended range instead of silently clamping creative input.

## Studio interaction

- Parts use visual selection cards rather than text-only dropdowns.
- Sliders include precise numeric entry and per-field reset.
- One continuous drag creates one undo history entry.
- Local drafts save automatically.
- **Save and use for sync** clearly writes the formal Studio appearance.
- Importing older JSON fills colors, belly, and expanded-range fields.
- Recipes remain local, with no upload or new browser permissions.
