# NOVA v0.6.8: Audit Child Rules, Tail Tip, and Motion Speech

## Delivery scope

This release adds four follow-up corrections on the v0.6.7 stabilization baseline: removing the small motion bubble, improving tail-tip visibility on dark backgrounds, repairing bundled motion-speech playback, and refining Page Audit scope down to each actual rule.

## Page Audit rules

- The shared domain now owns a registry of all 16 audit rules, providing one source of truth for rule codes and categories.
- The Side Panel lists every child rule under Performance, Accessibility, SEO, Best Practices, and DOM.
- Parent categories support selected, cleared, and partial states, while every child rule can be toggled independently.
- Selection is persisted in Chrome local storage, including migration from the v0.6.7 category-level setting.
- The Content Script checks rule codes before execution, so unchecked rules do not scan, produce findings, or affect scoring.
- Reports store the executed rule scope and distinguish checked rules from unchecked rules.

For example, disabling “Images lack intrinsic dimensions” skips `image-dimensions-missing` while lazy-image, long-task, and large-resource performance checks can remain enabled.

## Pet feedback

- The motion thought bubble and its state, timer, template, and styles are completely removed.
- All 18 pre-generated Chinese motion-speech files remain bundled with the extension and require no online TTS service.
- Speech assets are prefetched after the overlay mounts. A motion click immediately resumes the Web Audio context, then decodes, caches, and plays the matching MP3.
- A new motion stops the previous speech. Load or decode failures produce diagnostic logs and never fall back to a notification beep.

## Tail-tip effect

- The tail-tip tube no longer uses a highly transparent material.
- The endpoint uses an opaque light-independent bright core with tone mapping disabled.
- Its outer aura uses additive blending without depth writes and remains visible in the normal state.
- Tail Glow, Tail Tornado, Energy Burst, Star Juggle, and Fireworks continue to drive cycling multi-color flashes.

## Compatibility

This release adds no browser permission or runtime dependency. Existing audit reports remain readable, and legacy category settings safely map to every child rule in the selected categories on first load.
