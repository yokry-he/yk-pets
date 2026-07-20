# YK-PETS Browser Agent Product and Interaction Design

## 1. Product definition

YK-PETS is an in-page 3D AI frontend engineering companion platform. The current default pet is:

```text
Name: Zeph / 云灵
Species: Cloud Fox / 云狐
```

Clicking, double-clicking, right-clicking, hovering, or dragging Zeph can start audits, navigate findings, preview changes, and open engineering operations. The Side Panel remains the detailed workspace for reports, Network Lab, diffs, and command output. Once connected to the local CLI, YK-PETS can map a finding to source code, generate a minimal patch, run verification, and roll back—with explicit user confirmation at every write boundary.

```text
Observe → Explain → Locate → Preview → Generate patch → Confirm → Verify → Keep or roll back
```

## 2. Brand and character rules

- `YK-PETS` is the product and platform brand.
- `Zeph / 云灵` is the current pet's name.
- `Cloud Fox / 云狐` is the current species.
- Product headings must not use the pet name as the brand.
- Pet dialogue and motion feedback should use the pet name.
- Species traits, tail, antennae, and species capabilities should use the species name.
- Adding another pet must not require another product rename.

## 3. Target users

### Frontend developers

They want to discover verifiable issues in localhost projects and move from a browser finding to source candidates, diffs, and project checks without leaving the browser.

### Product, design, and QA users

They want a visual way to inspect test or production pages, identify specific elements, and preview changes without needing to edit code.

### Technical leads

They want repeatable engineering workflows where every automated change is reviewable, verifiable, and reversible.

## 4. Product surfaces

```text
Zeph in the bottom-right corner
├── mood, motion, and voice feedback
├── page audit
├── finding navigation and highlighting
├── reversible preview
├── detailed-report entry point
└── local engineering toolbox

YK-PETS Side Panel
├── page health and metrics
├── complete finding list
├── audit-rule scope
├── Network Lab and Mock rules
├── Local Agent connection
├── source candidates and patch diff
├── explicit apply and rollback
└── Typecheck / Test / Build output
```

The in-page pet is the natural interaction entry point. The Side Panel is the detailed information and high-risk confirmation surface.

## 5. Pet state feedback

Zeph is not decoration. The character communicates system state:

| System state | Zeph's expression |
|---|---|
| Waiting | listens and tracks the pointer |
| Auditing | thinking and core pulse |
| Healthy page | happy and tail movement |
| High-priority finding | confused head tilt |
| Generating patch | thinking with faster orbit light |
| Patch applied | excited celebration |
| Poor page state | resting |

Every important state also has readable text and must not rely only on animation or color.

## 6. Main interactions

| Interaction | Result |
|---|---|
| Click Zeph | open or close the feature menu |
| Double-click Zeph | run a page audit immediately |
| Right-click Zeph | open the engineering toolbox |
| Hover Zeph | greet and follow the pointer |
| Drag Zeph | change the in-page position |
| Click finding badge | enter finding navigation |

Double-click and right-click are shortcuts, never the only accessible path.

## 7. Visual and writing system

Product surfaces use `YK-PETS`. A complete first introduction can use:

```text
Zeph（云灵）· Cloud Fox（云狐）
```

Later dialogue can use “Zeph” without repeating the species.

Writing principles:

- Never claim that a problem was “automatically fixed” without qualification.
- Distinguish a temporary DOM preview from a source-code write.
- Show candidates and uncertainty when source mapping is not reliable.
- Explain the next step when an operation fails.
- Use first-person character dialogue for Zeph and explicit YK-PETS wording in engineering confirmation areas.
- NOVA may appear only in release history or explicit compatibility notes.

## 8. Accessibility and performance

- Every action is keyboard accessible.
- Icon buttons have text or `aria-label`.
- Health and severity are not conveyed only by color.
- Highlight layers never block host-page interaction.
- Shadow DOM isolates extension UI.
- Rendering should pause in hidden tabs.
- Reduced-motion preferences lower motion intensity.
- Low-performance devices and unavailable WebGL use a 2D fallback.

## 9. Multi-pet constraints

Every future pet must register an independent identity and capabilities:

- localized pet and species names;
- generic intents mapped to pet-specific motions;
- explicit fallbacks for unsupported motions;
- lazy-loaded assets and renderers;
- pet switching that does not reset audit, network, or Agent state;
- stable IDs used for storage instead of display names.

A second real pet is a platform acceptance requirement, proving that the architecture is not merely a wrapper around the Cloud Fox implementation.
