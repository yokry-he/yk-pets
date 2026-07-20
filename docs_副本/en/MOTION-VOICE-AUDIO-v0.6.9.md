# NOVA v0.6.9: Silent Motion-Speech Asset Fix

## Root cause

The v0.6.8 speech assets had valid MP3 headers, durations, and bitrates, so the original existence-and-decode checks passed. Their mean and peak volume were both `-91 dB`, however, making the waveform effectively silent. The offline synthesizer had used a Chinese voice identifier unsupported by the bundled voice pack.

## Correction

- Regenerated all 18 motion lines with the verified `zh` Chinese voice.
- Tuned base pitch and speed by motion, then applied a subtle global pitch lift for a lighter character.
- Applied high-pass, low-pass, and loudness normalization to reduce rumble, harsh high frequencies, and volume jumps between motions.
- Kept the assets offline as 24 kHz, mono, 64 kbps MP3 files bundled with the extension.

## Regression protection

The new `check:motion-voice-audio` command:

- confirms that all 18 files exist;
- uses FFprobe to validate decoding and reasonable duration;
- uses FFmpeg to measure mean and peak volume;
- fails when mean volume is below `-35 dB` or peak volume is below `-20 dB`.

The regenerated files average about `-18 dB` with peaks between roughly `-5 dB` and `-2.8 dB`, so they are no longer silent assets.
