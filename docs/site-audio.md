# Site audio

This change is a draft until the owner supplies the original Naruto theme recording.
The owner requested original audio only. No replacement, cover, synthesized music,
or generated voice is included. Do not publish the feature without the theme file.

## Files

- Required before release: `public/audio/naruto-theme.mp3`.
- Short soundboard references: Sharingan activation/return, Mangekyo activation,
  Naruto's Dattebayo and Believe it, and Madara's Wake up to reality.
- Provenance is in `public/audio/CREDITS.txt`.
- Replace the short references with the owner's preferred original clips if supplied.
  Keep the paths in `src/lib/site-audio-library.ts` in sync.

## Behavior

- A small Sound button and settings panel are added. Existing content and visual effects remain.
- No audio requests, AudioContext, or decoding until the visitor enables sound.
- One root-layout mixer persists during Next.js client navigation.
- Default music volume is 12%, dialogue 75%, effects 65%; all are adjustable.
- Independent Web Audio gain channels let voices overlap the continuously looping music.
- Random dialogue runs every 45–90 seconds, never repeats immediately, and skips typing,
  background tabs, and other active HTML audio/video.
- The settings panel offers a manual Play a dialogue button.
- Eye taps trigger Mangekyo audio once per transformation; returning to the normal state
  triggers the normal Sharingan effect. Rapid taps cannot stack effects.
- Hidden tabs suspend music and cancel speech/effects. Returning resumes the music.
- Mute cancels active and pending playback. Stored settings retain levels and the dialogue
  toggle; a refresh requires a new explicit sound click.
- Failed files can be retried; an unavailable effect never breaks the eye.

## Validation

`npm run typecheck`, `npm run lint`, and `npm test -- --runInBand`.
Mixer tests cover independent overlap, mute during loading, background-tab suspension,
missing music/retry, dialogue cancellation, settings parsing, and no immediate repeats.
UI tests cover opt-in, persistence, random-dialogue toggle, event wiring, and cleanup.

Before release, check the supplied theme and clips in a real browser, verify a client
navigation preserves the same playing music, and confirm the original soundtrack plays
quietly under dialogue. Test an actual iOS/Safari device when available.
