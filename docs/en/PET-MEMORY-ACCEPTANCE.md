# Pet Memory Manual Acceptance Checklist

Automated tests cannot replace real Chrome checks for the Side Panel, context menus, keyboard shortcuts, and in-page 3D feedback. Complete these flows before release.

## Quick capture

- Open a normal HTTP/HTTPS page.
- Press `Ctrl/Command + Shift + .`.
- Confirm that the Side Panel opens on Pet Memory.
- Confirm that the composer includes the page title and URL and receives keyboard focus.
- Enter text and press `Ctrl/Command + Enter`.
- Confirm that a new Inbox card appears and the in-page pet acknowledges the save.

## Selected text

- Select text on a page.
- Choose **Let Zeph remember this** from the context menu.
- Confirm that no large blocking overlay opens.
- Confirm that a quote card appears in the Inbox.
- Confirm that the current-page memory badge increments.
- Refresh the page and confirm that the badge remains correct.

## Status and editing

- Move an Inbox card to Todo.
- Mark a Todo card as Done.
- Confirm that Zeph produces completion feedback.
- Restore a completed card to Todo.
- Edit and save the title, body, tags, and priority.
- Archive a card and undo within six seconds.
- Verify search and tag filtering.

## Page Audit integration

- Run Page Audit.
- Choose **Remember** on an issue card.
- Confirm that the Side Panel switches to Pet Memory.
- Confirm that the new card starts in Todo.
- Verify its title, explanation, page, selector, category tags, and priority.

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
