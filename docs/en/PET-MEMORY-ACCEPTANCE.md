# Pet Memory Manual Acceptance Checklist

Automated tests cannot replace real Chrome checks for the Side Panel, context menus, keyboard shortcuts, Local Agent, and in-page 3D feedback. Complete these flows before release.

## Quick capture

- Open a normal HTTP/HTTPS page.
- Press `Ctrl/Command + Shift + .`.
- Confirm that the Side Panel opens on Pet Memory.
- Confirm that the composer includes the page title and URL and receives keyboard focus.
- Enter text and press `Ctrl/Command + Enter`.
- Confirm that a new Inbox card appears and Cloud Fox acknowledges the save.

## Selected text

- Select text on a page.
- Choose **Let Cloud Fox remember this** from the context menu.
- Confirm that no large blocking overlay opens.
- Confirm that a quote card appears in the Inbox.
- Confirm that the current-page memory badge increments.
- Refresh the page and confirm that the badge remains correct.

## Current-page memory badge

- Confirm that the badge shows the correct count when non-archived memories exist and that the enhanced button is absent at zero.
- Click the badge and confirm that it opens only the Side Panel without opening the pet ring menu or starting a drag.
- Focus the badge with `Tab`, then activate it with both `Enter` and Space; verify a clear focus ring.
- Set a search query and tag filter first, then confirm that the badge clears both.
- Confirm that the Side Panel activates Current Page directly and moves focus to that filter button.
- While the Side Panel is on Page Audit or Network Lab, confirm that the badge still switches to Pet Memory.
- Verify that loading, success, and failure states remain usable in a narrow Side Panel.
- Change the active tab immediately after clicking and confirm that the request is not applied to the wrong page and a retry message is shown.
- Confirm that the one-shot local request key is deleted after completion or after its 30-second lifetime.
- Repeated count updates must not accumulate buttons, MutationObservers, or storage listeners.

## Status and editing

- Move an Inbox card to Todo.
- Mark a Todo card as Done.
- Confirm that Cloud Fox produces completion feedback.
- Restore a completed card to Todo.
- Edit and save the title, body, tags, and priority.
- Archive a card and undo within six seconds.
- Verify search and tag filtering.

## Page excerpt relocation

- Save a selection that spans multiple inline elements on the current page.
- Choose **Locate excerpt** and confirm that the page scrolls to an exact browser selection with a short-lived overlay.
- When the same text appears more than once, confirm that the result reports the match count and selects the first visible match.
- Switch to another tab, locate again, and confirm that a new source tab opens and completes the highlight.
- Change or remove the source text and confirm a clear failure state without continuous scanning.
- Verify both an imported card with a selector and an older selector-free card, confirming that each locates the excerpt or reports a clear failure.
- Confirm that the overlay disappears after about 12 seconds and reduced-motion mode avoids smooth scrolling.
- Repeated relocation must not accumulate scroll, resize, or runtime listeners.

## Page Audit integration

- Run Page Audit.
- Choose **Remember** on an issue card.
- Confirm that the Side Panel switches to Pet Memory.
- Confirm that the new card starts in Todo.
- Verify its title, explanation, page, selector, category tags, priority, and `relatedAuditIssueId`.

## Continuing an audit memory into a Local Agent patch

- Remember at least two Page Audit findings with different severity levels or categories.
- Return to Pet Memory and confirm that **Generate Patch** appears only for Audit cards with a related issue identifier.
- In Page Audit, set severity and category filters that hide the target finding, return to the memory card, and choose **Generate Patch**.
- Confirm that the Side Panel switches to Page Audit, resets both filters to All, and scrolls and focuses the correct IssueCard.
- Confirm that restoration uses the saved `relatedAuditIssueId`; another issue with a similar title must not be selected.
- With a saved valid token but a disconnected Local Agent, activate the entry and confirm that it follows the existing connection path before generating a proposal.
- With no token, confirm that the existing Agent settings and error state open and token validation is not bypassed.
- While the Agent status is `connecting`, activate repeatedly and confirm that no second WebSocket or duplicate generation request is created.
- While patch generation, apply, checks, or rollback is busy, confirm that another activation is blocked.
- After connection, confirm that the existing Diff remains visible and that Apply, Checks, and Rollback are available only through the existing controls.
- Change to another active tab and confirm a source-page mismatch error without generating a patch.
- Remove `nova:report:<tabId>` for the current tab and confirm that the flow asks for a new audit.
- Run a new audit that no longer contains the saved `relatedAuditIssueId`; confirm a missing-linked-issue error instead of title or body guessing.
- In Chrome extension inspection tools, confirm that the feature adds no permission, background polling, upload, persistent host-page DOM mutation, or independent `patch.generate` call.

## JSON import and export

- Download Markdown and verify readable content.
- Download JSON and verify a complete structure.
- Confirm that archived content is excluded from the default export.
- Choose **Import JSON** and import the file that was just exported.
- Confirm that the import button shows a loading state and the result separately reports imported, duplicate, conflicting, invalid, and capacity-truncated cards.
- Confirm that the first import adds cards and importing the same file again reports duplicates without creating copies.
- Change the content of a card while keeping an existing ID, import it again, and confirm that it is reported as a conflict without overwriting local content.
- Confirm clear errors for invalid JSON, a missing `cards` array, versions other than 1, and files larger than 8 MB.
- Confirm that Current Page, search, status actions, and the in-page memory badge refresh after import.
- Confirm that importing does not upload the file or add permissions.

## Performance and non-interference

- Pet Memory does not continuously scan the page DOM while the Side Panel is closed.
- The page listens for extension-local storage changes without polling.
- Save, import, and completion feedback do not interrupt an active manually selected motion.
- The memory badge does not cover the audit badge or the pet click target.
- Repeatedly switch between Pet Memory and Page Audit and confirm that Generate Patch buttons, status nodes, and MutationObservers do not accumulate.
