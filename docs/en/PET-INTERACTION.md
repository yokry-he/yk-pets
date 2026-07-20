# In-page 3D Zeph Interaction Design

## 1. Identity

```text
Product: YK-PETS
Pet name: Zeph / 云灵
Pet species: Cloud Fox / 云狐
```

This document describes Zeph as the current default pet in YK-PETS. The product brand and pet identity must not be mixed.

## 2. Design goal

YK-PETS lives in the bottom-right corner of pages where the extension is allowed to run. Users do not need to understand extension architecture first: interacting with Zeph can start audits, navigate findings, preview changes, connect the Local Agent, generate source patches, verify changes, and roll them back.

The Side Panel continues to provide detailed reports, credentials, Network Lab, diffs, and command output, while the main workflow can be initiated through Zeph.

## 3. Position and presentation

- Zeph is positioned `18px` from the right and bottom by default.
- Shadow DOM prevents host-page CSS from leaking into the pet UI.
- The 3D model loads during browser idle time.
- The canvas is transparent and uses a constrained DPR.
- Dragging is constrained to the current viewport.
- A finding-count badge appears when the page contains findings.
- Audits, patches, and verification display motion plus readable state.
- A complete identity introduction is “Zeph（云灵）· Cloud Fox（云狐）”.

## 4. Interaction semantics

| Interaction | Result |
|---|---|
| Click Zeph | toggle the quick-feature menu |
| Double-click Zeph | run a page audit immediately |
| Right-click Zeph | open the local engineering toolbox |
| Hover Zeph | greet and follow the pointer |
| Drag Zeph | change the in-page position |
| Click finding count | enter finding navigation |

Every interaction has a keyboard-accessible button and readable name. Double-click and right-click are shortcuts, not exclusive entry points.

## 5. Quick-feature menu

The menu provides:

1. **Page audit** for DOM, resources, performance, and accessibility.
2. **Full report** in the Side Panel.
3. **Finding navigation** with previous, next, and highlight actions.
4. **Preview / undo preview** for reversible DOM changes.
5. **Motions** that control Zeph's behavior and expression.
6. **Engineering tools** for Local Agent, patches, checks, and rollback.
7. **Network Lab** for request inspection, mocking, delays, and response changes.

Unavailable actions remain disabled and explain why.

## 6. Engineering toolbox

Engineering actions include:

1. connect the YK-PETS Local Agent;
2. generate a source patch;
3. explicitly confirm a source write;
4. run project checks;
5. roll back the latest patch.

The in-page pet emits constrained actions only and never receives or executes arbitrary shell commands.

## 7. State feedback

| Operation state | Zeph behavior | Example copy |
|---|---|---|
| Waiting | idle / listening | Touch me to open all features. |
| Page audit | thinking | I am checking structure, resources, and accessibility. |
| Healthy page | happy | The page looks healthy. |
| High-priority finding | confused | I found something that should be handled first. |
| Finding highlighted | listening | This is finding 2: the image has no intrinsic dimensions. |
| Temporary preview | happy | The temporary change is active. |
| Agent connection | thinking | Connecting to the YK-PETS Local Agent. |
| Patch ready | happy | The source patch is ready. |
| Patch applied | excited | The patch has been written to the project. |
| Checks passed | excited | All project checks passed. |
| Failure | confused | Explain the reason and next step. |

## 8. Page and Side Panel collaboration

```text
Zeph in the page
├─ Local: audit, navigate, highlight, preview, undo
└─ Delegated: connect Agent, generate patch, write, verify, roll back
```

The Content Script persists delegated actions through the Background Service Worker so Side Panel startup delays do not lose commands. Side Panel execution state is then synchronized back to Zeph.

## 9. Brand compatibility

Legacy `v0.6.10` components can still produce NOVA technical wording. `apps/extension/brand.ts` converts it consistently across normal DOM and open Shadow Roots:

- product names become YK-PETS;
- pet-related wording becomes Zeph（云灵）;
- storage keys migrate and mirror between `nova:*` and `yk-pets:*`.

The bridge should be removed after native component renaming is complete.

## 10. Responsive, performance, and accessibility rules

- Desktop menus appear to the left of Zeph; narrow layouts stack above.
- Menu width is constrained to the viewport.
- Only the pet and menu regions receive pointer events.
- Hidden tabs should pause rendering.
- Low-performance devices use reduced DPR or a 2D fallback.
- Reduced-motion preferences lower movement intensity.
- Every interactive element has an accessible name.
