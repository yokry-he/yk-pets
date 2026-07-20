# In-page 3D NOVA Interaction Design

## 1. Design goal

NOVA's primary entry point moves from the Side Panel to the bottom-right corner of every page where the extension is allowed to run. Users do not need to understand extension architecture first: interacting with the 3D cloud fox can start page audits, navigate findings, preview fixes, connect the Local Agent, generate source patches, verify changes, and roll them back.

The Side Panel remains the detailed workspace for reports, credentials, diffs, and command output, but every primary workflow can be initiated through the animal.

## 2. Default placement and presentation

- The cloud fox is fixed to the bottom-right corner, `18px` from the right and bottom edges by default.
- Shadow DOM isolates the overlay from host-page CSS.
- The fox initializes during browser idle time rather than blocking first-page logic.
- The 3D canvas uses a transparent background.
- Users can drag the fox, with its position constrained to the viewport.
- When findings exist, an issue-count badge appears above the fox.
- Audits, patch generation, and verification display a busy indicator and thinking animation.

## 3. Animal interaction semantics

| Animal interaction | Result |
|---|---|
| Single-click the fox | Expand or collapse the quick-action menu |
| Double-click the fox | Run a page audit immediately |
| Right-click the fox | Open the local engineering toolbox |
| Hover over the fox | Play a greeting and follow the pointer |
| Drag the fox | Reposition it within the page |
| Use the issue badge/menu | Navigate audit findings |

All actions also exist as keyboard-accessible buttons with accessible names. Double-click and right-click are accelerators, not exclusive controls.

## 4. Quick-action menu

Single-clicking the fox exposes six primary actions:

1. **Page audit**: read DOM, resource, performance, and accessibility data and create an `AuditReport`.
2. **Previous issue**: select and locate the previous audit finding.
3. **Next issue**: select and locate the next audit finding.
4. **Preview fix / Undo preview**: apply a safe temporary DOM change for the active issue or restore the original state.
5. **Detailed report**: open the Side Panel and focus the report area.
6. **Engineering tools**: expand Local Agent operations.

Actions remain disabled when no audit exists or the active issue cannot be previewed. NOVA explains the missing prerequisite.

## 5. Local engineering toolbox

The toolbox opens from right-click or the Engineering Tools button:

1. **Connect Local Agent**: open the Side Panel WebSocket URL and token area; automatically attempt connection when saved credentials are available.
2. **Generate source patch**: send the active issue and page URL to the Local Agent for source search and a minimal diff.
3. **Confirm patch write**: execute only when an applicable proposal exists; the Local Agent verifies hashes and creates a backup before writing.
4. **Run project checks**: execute the allowlisted `typecheck`, `test`, and `build` scripts.
5. **Roll back latest patch**: restore the backup only while the current file still matches the post-patch hash.

The browser animal emits constrained actions only. It never receives or executes arbitrary shell commands.

## 6. State feedback

| Operation state | Cloud-fox behavior | Example copy |
|---|---|---|
| Waiting | idle / listening | Touch me to open every available function. |
| Auditing | thinking | Checking page structure, resources, and accessibility. |
| Healthy page | happy | The page is in good condition. |
| High-priority issue | confused | I found an issue that should be handled first. |
| Locating an issue | listening | Issue 2: the image has no intrinsic dimensions. |
| Temporary preview | happy | The temporary change is now applied. |
| Connecting Agent | thinking | Connecting to the local project Agent. |
| Patch ready | happy | The source patch is ready for review. |
| Patch applied | excited | The patch has been written to the project. |
| Verification passed | excited | Every project check passed. |
| Failure or missing prerequisite | confused | Show the exact reason and next step. |

## 7. Page and Side Panel collaboration

```text
In-page 3D NOVA
  ├─ Handles locally: audit, issue navigation, locate, preview, undo
  └─ Delegates to Side Panel: Agent connection, patch generation, write, checks, rollback
```

Delegation flow:

1. The Content Script sends an action and the active issue ID to the Background Service Worker.
2. The Service Worker persists the pending action in `chrome.storage.local`, then opens the Side Panel.
3. The Side Panel consumes the pending action on startup; if it is already open, it receives a Runtime Message immediately.
4. The Side Panel sends execution state back to the Content Script.
5. The in-page fox updates animation, speech, and busy state.

Persisting pending actions prevents commands from being lost while the Service Worker sleeps or the Side Panel initializes.

## 8. Responsive behavior and avoidance

- On desktop, the quick menu sits to the left of the fox and the engineering toolbox stacks above it.
- On narrow screens, menus stack above the fox.
- Menu widths are constrained by the viewport; long labels wrap or truncate safely.
- Issue-location labels keep using external auto-placement and remain separate from the pet interaction layer.
- The overlay uses the extension's top visual layer, but only the animal and visible menus accept pointer events, avoiding large page-blocking regions.

## 9. Performance budget

The current version initializes the 3D component during browser idle time and limits DPR. Follow-up targets include:

- Split the audit collector and 3D pet into separate Content Script bundles.
- Use a lower DPR or a 2D fallback on low-performance devices.
- Pause rendering when the tab is hidden.
- Reduce animation amplitude under `prefers-reduced-motion: reduce`.
- Add per-site controls for disabling or restoring the 3D animal.
