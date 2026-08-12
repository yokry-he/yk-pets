# Pet Studio Advanced Interaction

## Search and navigation

The top search field locates parts, parameters, and common names. Searching for nose, belly, colors, tail, orbit, or corresponding Chinese terms switches to the related workspace. Press `/` outside an input to focus search. Press `Escape` to clear search and exit classic comparison.

## Current versus classic comparison

The preview toolbar includes **Compare classic**. Entering comparison stores an exact current-recipe snapshot, temporarily switches the preview and controls to the extension classic recipe, and locks editing and save actions. Returning or leaving the page restores the exact snapshot without writing draft data or undo history. Studio reports which configuration groups differ.

## Clickable part focus

Head, body, tail, and symbol hotspots appear over the preview. They support mouse and keyboard and switch to the corresponding editor. They do not inspect the host page or add a WebGL picking loop or second renderer.

## Local schemes and history

The advanced panel names and stores the current appearance locally. Schemes can be applied or deleted through the existing Pinia Store and `localStorage`, with no upload. It also shows the latest automatic draft time and Undo/Redo counts.
