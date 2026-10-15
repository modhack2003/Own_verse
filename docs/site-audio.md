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

- The public page has one icon button: mute/unmute theme music only. It never
  stops dialogue or Sharingan effects. The visitor's theme mute preference is
  saved separately; old per-browser volume settings are ignored.
- Automatic startup attempts to play the theme on load. Browser autoplay policy
  may suspend it until the first pointer or key interaction. That interaction
  unlocks the same mixer; it never creates duplicate theme sources.
- The theme starts at zero gain and ramps to its configured level over 4 seconds,
  then holds there. Default theme is 75%, dialogue 100%, and eye effects 95%.
- The theme loops continuously beneath voices and effects. A master compressor
  reduces peaks when loud channels mix; individual sources remain independent.
- The first dialogue starts after 20 seconds of active playback. Every later
  dialogue waits 20 seconds after the previous recording ENDS, irrespective of
  clip length. Settings refreshes do not restart an unchanged countdown.
- Consecutive recordings do not repeat when multiple clips are enabled.
- Background tabs suspend the mixer and cancel dialogue/effects; resuming starts
  a fresh dialogue gap. Typing and active HTML audio/video defer the next quote.
- One root-layout mixer persists across client navigation. Refresh tries autoplay
  again while respecting the saved theme mute preference.

## Admin settings

The authenticated dashboard has a **Site audio** section with all three channel
levels, dialogue gap (1–600 seconds), theme fade (0–30 seconds), automatic
character dialogue, and individual clip enable switches and preview players.
Defaults can be restored in the form, then saved explicitly.

`GET /api/site-audio` returns public, non-sensitive settings; before the first
save it returns the defaults. `PUT /api/site-audio` requires the existing admin
session and validates every field and playlist ID. Settings are stored in the
MongoDB `SiteAudioConfig` singleton, not a browser preference or local file.
Prisma's normal generate step includes the new model; no existing documents or
fields are changed. The singleton is created on the first authenticated save.
Open visitor pages fetch changes every minute, while the saving admin tab
refreshes immediately. Settings failures preserve the built-in playback defaults;
the admin form reports the error and never pretends an unsuccessful save worked.

## Validation

Run TypeScript, ESLint, Jest, and the production build. Tests cover theme-only
mute, fade targets, short and long dialogue completion plus the full gap,
blocked-autoplay unlock without duplicate music, admin-only writes, persistence
contracts, invalid settings, playlist assets, and public/admin UI separation.
Browser checks should exercise the fade, theme-only mute with active dialogue
and effects, all nine audio decoders, and admin preview/save behavior. Actual
mobile Safari/device listening remains a separate check when available.
