/** Local files only: browsing never depends on a soundboard being online. */
export const SHARINGAN_AUDIO_EVENT = 'nd:sharingan-audio';
export type SharinganSound = 'mangekyo' | 'sharingan';

export function sharinganSound(phase: SharinganSound) {
  window.dispatchEvent(new CustomEvent<SharinganSound>(SHARINGAN_AUDIO_EVENT, { detail: phase }));
}

export const MUSIC_TRACK = '/audio/naruto-theme.mp3';

export const DIALOGUES = [
  { id: 'dattebayo', character: 'Naruto', text: 'Dattebayo!', src: '/audio/dattebayo.mp3' },
  { id: 'believe-it', character: 'Naruto', text: 'Believe it!', src: '/audio/believe-it.mp3' },
  { id: 'wake-up', character: 'Madara', text: 'Wake up to reality.', src: '/audio/wake-up.mp3' },
] as const;

export type Dialogue = (typeof DIALOGUES)[number];
export type AudioSettings = { music: number; dialogue: number; effects: number; randomDialogue: boolean };
export const AUDIO_STORAGE_KEY = 'nd-audio-settings-v1';
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  music: 0.12, dialogue: 0.75, effects: 0.65, randomDialogue: true,
};

export function parseAudioSettings(raw: string | null): AudioSettings {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return { ...DEFAULT_AUDIO_SETTINGS };
    const record = value as Record<string, unknown>;
    const level = (key: 'music' | 'dialogue' | 'effects') => {
      const v = record[key];
      return typeof v === 'number' && Number.isFinite(v)
        ? Math.max(0, Math.min(1, v)) : DEFAULT_AUDIO_SETTINGS[key];
    };
    return {
      music: level('music'), dialogue: level('dialogue'), effects: level('effects'),
      randomDialogue: typeof record.randomDialogue === 'boolean'
        ? record.randomDialogue : DEFAULT_AUDIO_SETTINGS.randomDialogue,
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

/** Random timing avoids a repetitive loop; consecutive quotes never repeat. */
export const dialogueDelay = () => 45_000 + Math.floor(Math.random() * 45_000);
export function nextDialogueIndex(previous: number, random = Math.random()): number {
  if (previous < 0) return Math.floor(random * DIALOGUES.length) % DIALOGUES.length;
  return (previous + 1 + Math.floor(random * (DIALOGUES.length - 1))) % DIALOGUES.length;
}
