/** Local files only: browsing never depends on a soundboard being online. */
export const SHARINGAN_AUDIO_EVENT = 'nd:sharingan-audio';
export type SharinganSound = 'mangekyo' | 'sharingan';

export function sharinganSound(phase: SharinganSound) {
  window.dispatchEvent(new CustomEvent<SharinganSound>(SHARINGAN_AUDIO_EVENT, { detail: phase }));
}

export const MUSIC_TRACK = '/audio/naruto-theme.mp3';

export const DIALOGUES = [
  { id: 'obito-heart', character: 'Obito', text: 'Look at me! There is nothing in my heart.', src: '/audio/01_obito_heart.mp3' },
  { id: 'itachi-hate', character: 'Itachi', text: 'You are still too weak. You do not have enough hate.', src: '/audio/02_itachi_weak_hate.mp3' },
  { id: 'itachi-genjutsu', character: 'Itachi', text: 'You are already under my genjutsu.', src: '/audio/03_itachi_genjutsu.mp3' },
  { id: 'obito-love', character: 'Obito', text: 'When a man learns to feel love, he must also bear the risk of feeling hate.', src: '/audio/04_obito_love_hate.mp3' },
  { id: 'madara-reality', character: 'Madara', text: 'Wake up to reality.', src: '/audio/05_madara_reality.mp3' },
  { id: 'pain', character: 'Pain', text: 'Feel pain, accept pain, and know pain.', src: '/audio/06_pain_partial.mp3' },
  { id: 'madara-despair', character: 'Madara', text: 'This world holds only despair. It is not worth existing.', src: '/audio/07_madara_despair.mp3' },
  { id: 'jiraiya-life', character: 'Jiraiya', text: 'In the shinobi world, it is not how you live. It is how you die.', src: '/audio/08_jiraiya_shinobi_life.mp3' },
  { id: 'itachi-reality', character: 'Itachi', text: 'Each of us lives dependent and bound by our individual knowledge and our awareness.', src: '/audio/09_itachi_reality.mp3' },
] as const;

export type Dialogue = (typeof DIALOGUES)[number];
export type AudioSettings = {
  music: number; dialogue: number; effects: number; randomDialogue: boolean;
  intervalSeconds: number; fadeSeconds: number; enabledDialogueIds: string[];
};
export const THEME_MUTE_KEY = 'nd-theme-muted-v1';
export const AUDIO_SETTINGS_EVENT = 'nd:audio-settings';
export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  music: 0.75, dialogue: 1, effects: 0.95, randomDialogue: true,
  intervalSeconds: 20, fadeSeconds: 4, enabledDialogueIds: DIALOGUES.map(q => q.id),
};

export function parseAudioSettings(raw: unknown): AudioSettings {
  try {
    const value: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw;
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
      intervalSeconds: typeof record.intervalSeconds === 'number' && Number.isFinite(record.intervalSeconds)
        ? Math.max(1, Math.min(600, Math.round(record.intervalSeconds))) : DEFAULT_AUDIO_SETTINGS.intervalSeconds,
      fadeSeconds: typeof record.fadeSeconds === 'number' && Number.isFinite(record.fadeSeconds)
        ? Math.max(0, Math.min(30, record.fadeSeconds)) : DEFAULT_AUDIO_SETTINGS.fadeSeconds,
      enabledDialogueIds: Array.isArray(record.enabledDialogueIds)
        ? [...new Set(record.enabledDialogueIds.filter((id): id is string =>
          typeof id === 'string' && DIALOGUES.some(q => q.id === id)))]
        : [...DEFAULT_AUDIO_SETTINGS.enabledDialogueIds],
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

/** The scheduler starts its gap after the prior recording ends. */
export function nextDialogueIndex(previous: number, random = Math.random(), enabledIds = DEFAULT_AUDIO_SETTINGS.enabledDialogueIds): number {
  const enabled = DIALOGUES.flatMap((q, i) => enabledIds.includes(q.id) ? [i] : []);
  const choices = enabled.filter(i => i !== previous);
  const pool = choices.length ? choices : enabled;
  return pool.length ? pool[Math.min(pool.length - 1, Math.floor(random * pool.length))] : -1;
}
