# NOVA Browser Agent v0.6.9 Validation Report

## Correction scope

Regenerated and replaced all 18 Chinese motion-speech assets whose v0.6.8 waveforms were effectively silent, while keeping the existing Web Audio playback path.

## Audio validation

- All 18 MP3 files decode through FFprobe and FFmpeg.
- Durations range from 2.50 to 5.30 seconds.
- Mean volume ranges from `-18.3 dB` to `-17.6 dB`.
- Peak volume ranges from `-4.8 dB` to `-2.8 dB`.
- The new audio regression fails when mean volume is below `-35 dB` or peak volume is below `-20 dB`.

## Engineering validation

- v0.6.9 audit, pet-visual, and speech checks: 12/12 passed.
- Bilingual documentation and code-comment checks passed.
- Extension Vue/TypeScript type checking passed.
- Chrome MV3 production build and ZIP generation passed.
- All 18 MP3 files in the production package are byte-identical to their source assets.
- ZIP integrity validation passed.

## Manual check

Play the delivered `greeting.mp3` first. After confirming local playback, reload the v0.6.9 extension, refresh the target page, and test motions such as Greeting, Eating, Cloud Nap, and Tail Glow inside the browser.
