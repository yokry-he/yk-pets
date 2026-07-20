# NOVA v0.6.10: Switchable Pet Voices and System Cute-Voice Presets

## Voice presets

- **Nebula Alien**: keeps the 18 bundled electronic Chinese MP3 files for fully offline and device-consistent playback.
- **Cute Girl**: uses system Chinese TTS, prioritizes natural or neural voices, and applies a gentle `1.28` pitch with a `0.94` rate.
- **Cute Companion**: uses the same system-voice selector with a more lively `1.7` pitch and `1.12` rate for a generic anime-pet style.
- **Mute**: keeps motions active without motion speech.

## Interaction

A Motion Voice setting now appears below the pet entry in the Side Panel. Users can select any preset and press Preview. Selection is stored in `chrome.storage.local`, and the in-page pet watches storage changes so the new preset applies without a refresh.

## Voice selection and fallback

The background obtains device voices through `chrome.tts.getVoices()`, prioritizes `zh-CN`, then scores names that indicate natural, neural, or common Chinese feminine voices. If no enumerable Chinese voice exists, Chrome selects its default engine from the `zh-CN` language request.

Final quality depends on the operating system, installed speech packages, and Chrome environment. The settings card displays the actual voice name used for preview, making the device-level choice visible.

## Permission and boundaries

The new `tts` extension permission is used only for user-selected pet motion lines. A new motion interrupts prior motion speech, and muting or changing presets stops current speech. The project neither copies nor claims to use any specific anime character voice.
