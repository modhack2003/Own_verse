# Site audio

The owner supplied the theme and Sharingan transformation effect and approved
the six internet dialogue finds. Their three additional dialogue uploads bring
the playlist to nine clips. The recordings were cleaned without generating or
replacing voices. Third-party uploads have not been independently authenticated
as original-cast masters; the owner accepted the candidates for this project.

## Files

- `public/audio/naruto-theme.mp3`: the owner's approximately 29-second theme,
  normalized with a 500 ms circular crossfade (about 28.5 seconds per loop).
- `public/audio/mangekyo.mp3`: the owner's transformation effect, with its
  approximately 300 ms leading silence removed for responsive eye taps.
- `public/audio/sharingan.mp3`: the existing normal-eye return effect.
- Nine dialogue clips: Obito's heart and love/hate lines; Itachi's weak/hate,
  genjutsu and reality passages; Madara's reality and despair lines; Pain;
  and Jiraiya's shinobi-life passage.
- Provenance is in `public/audio/CREDITS.txt`.
- Processing and measured levels are in `public/audio/audio-report.json`.
- The older draft's Dattebayo, Believe it, and duplicate short Wake up clip have
  been replaced by the approved nine-clip review playlist.

## Behavior

- A small Sound button and settings panel are added. Existing content and visual effects remain.
- No audio requests, AudioContext, or decoding until the visitor enables sound.
- One root-layout mixer persists during Next.js client navigation.
- Default music volume is 12%, dialogue 75%, effects 65%; all are adjustable.
- The theme and dialogue files are normalized near -18 LUFS before channel gain,
  placing dialogue about 16 dB above the theme at the default settings.
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

Manual browser verification should cover a complete loop, dialogue/effect overlap,
mute, sliders and a client navigation preserving the same music source. Actual
iOS/Safari device listening remains a separate check when a device is available.
