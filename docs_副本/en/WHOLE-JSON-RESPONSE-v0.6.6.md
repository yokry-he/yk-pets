# NOVA v0.6.6: Whole-JSON Real Response Editing

## New interaction

Modify Real Response no longer displays Set Field, Remove Field, JSON Path, or Field Value controls. It now presents one complete JSON editor.

When a rule is generated from a captured request, the editor prioritizes the complete JSON returned by that request. Any nested object, array, or value can be edited directly, and the whole document becomes the response body received by the page after the rule is saved.

## Runtime behavior

- The request is still sent to the real endpoint.
- The real HTTP status, status text, and response headers are preserved.
- Only the JSON body is replaced with the complete JSON saved in the rule.
- Fetch and XHR use the same behavior.
- Editable JSON capture is limited to 512 KB to avoid excessive memory use.

## Compatibility

Field-level response rules created by v0.6.5 and earlier remain executable. Opening and saving an old rule migrates it to the whole-JSON replacement format.

## Workflow

1. Refresh the page and trigger the target request again.
2. Open its request details and choose Generate Rule from Request.
3. Select Modify Real Response.
4. Edit the complete document in Real Response JSON.
5. Save and enable the rule, then trigger the request again.
