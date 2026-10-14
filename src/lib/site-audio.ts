import {
  DEFAULT_AUDIO_SETTINGS, DIALOGUES, MUSIC_TRACK, nextDialogueIndex,
  type AudioSettings, type Dialogue, type SharinganSound,
} from './site-audio-library';

export type AudioStatus = {
  enabled: boolean; loading: boolean; error: string | null; quote: Dialogue | null;
};
export const SILENT_AUDIO_STATUS: AudioStatus = {
  enabled: false, loading: false, error: null, quote: null,
};

type Channel = 'music' | 'dialogue' | 'effects';

/**
 * One mixer for the root layout. Web Audio gains also work on mobile Safari,
 * where HTMLMediaElement.volume cannot reliably provide independent levels.
 * No context, requests, or decoding happen until the explicit sound button.
 */
export class SiteAudioEngine {
  private context: AudioContext | null = null;
  private gains: Record<Channel, GainNode> | null = null;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private music: AudioBufferSourceNode | null = null;
  private voice: AudioBufferSourceNode | null = null;
  private effect: AudioBufferSourceNode | null = null;
  private musicOffset = 0;
  private musicStartedAt = 0;
  private lastDialogue = -1;
  private voiceLoading = false;
  private voiceRequest = 0;
  private effectRequest = 0;
  private epoch = 0;
  private disposed = false;
  private settings = { ...DEFAULT_AUDIO_SETTINGS };
  private status = { ...SILENT_AUDIO_STATUS };

  constructor(private changed: (status: AudioStatus) => void) {}

  private update(patch: Partial<AudioStatus>) {
    this.status = { ...this.status, ...patch };
    if (!this.disposed) this.changed({ ...this.status });
  }

  private setup() {
    if (this.context) return this.context;
    const BrowserAudioContext = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!BrowserAudioContext) throw new Error('Audio is unavailable in this browser.');
    const context = new BrowserAudioContext();
    this.context = context;
    const music = context.createGain();
    const dialogue = context.createGain();
    const effects = context.createGain();
    this.gains = { music, dialogue, effects };
    for (const key of ['music', 'dialogue', 'effects'] as const) {
      this.gains[key].gain.value = this.settings[key];
      this.gains[key].connect(context.destination);
    }
    return context;
  }

  setSettings(settings: AudioSettings) {
    this.settings = { ...settings };
    if (this.context && this.gains) {
      for (const key of ['music', 'dialogue', 'effects'] as const) {
        this.gains[key].gain.setTargetAtTime(settings[key], this.context.currentTime, 0.03);
      }
    }
    if (!settings.randomDialogue || settings.dialogue === 0) this.stopDialogue();
  }

  private buffer(src: string) {
    let pending = this.buffers.get(src);
    if (!pending) {
      const context = this.context;
      if (!context) return Promise.reject(new Error('Audio is not enabled.'));
      pending = fetch(src, { signal: AbortSignal.timeout(20_000) })
        .then((response) => {
          if (!response.ok) throw new Error('Audio file unavailable.');
          return response.arrayBuffer();
        })
        .then((data) => context.decodeAudioData(data))
        .catch((error: unknown) => {
          this.buffers.delete(src); // A failed fetch can be retried.
          throw error;
        });
      this.buffers.set(src, pending);
    }
    return pending;
  }

  private node(buffer: AudioBuffer, channel: Channel) {
    const node = this.context!.createBufferSource();
    node.buffer = buffer;
    node.connect(this.gains![channel]);
    return node;
  }

  async enable() {
    if (this.disposed || this.status.enabled) return;
    const epoch = ++this.epoch;
    this.update({ enabled: true, loading: true, error: null });
    try {
      const context = this.setup();
      // Called in the click handler before the first await to unlock iOS audio.
      const unlocked = context.resume();
      // Tiny effects are loaded alongside music so the first eye tap is responsive.
      void this.buffer('/audio/mangekyo.mp3').catch(() => {});
      void this.buffer('/audio/sharingan.mp3').catch(() => {});
      const [buffer] = await Promise.all([this.buffer(MUSIC_TRACK), unlocked]);
      if (!this.status.enabled || this.disposed || epoch !== this.epoch) return;
      if (document.hidden) await context.suspend();
      if (!this.status.enabled || this.disposed || epoch !== this.epoch) return;
      const music = this.node(buffer, 'music');
      music.loop = true;
      music.start(0, this.musicOffset % buffer.duration);
      this.musicStartedAt = context.currentTime;
      this.music = music;
      this.update({ loading: false });
    } catch {
      if (this.disposed || epoch !== this.epoch) return;
      this.disable();
      this.update({ error: 'Audio could not start. Tap Sound to retry.' });
    }
  }

  private stop(node: AudioBufferSourceNode | null) {
    if (!node) return;
    node.onended = null;
    try { node.stop(); } catch { /* The source may already have ended. */ }
    node.disconnect();
  }

  stopDialogue() {
    ++this.voiceRequest;
    this.stop(this.voice);
    this.voice = null;
    if (this.status.quote) this.update({ quote: null });
  }

  disable() {
    ++this.epoch; // In-flight downloads cannot start playback after mute.
    ++this.effectRequest;
    if (this.music && this.context) {
      this.musicOffset += this.context.currentTime - this.musicStartedAt;
    }
    this.stop(this.music);
    this.music = null;
    this.stopDialogue();
    this.stop(this.effect);
    this.effect = null;
    this.update({ enabled: false, loading: false, quote: null });
    void this.context?.suspend().catch(() => {});
  }

  async visibilityChanged() {
    if (!this.context || !this.status.enabled) return;
    if (document.hidden) {
      this.stopDialogue();
      this.stop(this.effect);
      this.effect = null;
      ++this.effectRequest;
      await this.context.suspend().catch(() => {});
    } else {
      try { await this.context.resume(); }
      catch {
        this.disable();
        this.update({ error: 'Tap Sound to resume audio.' });
      }
    }
  }

  async playSharingan(phase: SharinganSound) {
    if (!this.status.enabled || document.hidden || this.settings.effects === 0) return;
    const epoch = this.epoch;
    const request = ++this.effectRequest;
    try {
      const buffer = await this.buffer('/audio/' + phase + '.mp3');
      if (epoch !== this.epoch || request !== this.effectRequest || document.hidden ||
          !this.status.enabled || this.context?.state !== 'running') return;
      this.stop(this.effect);
      const effect = this.node(buffer, 'effects');
      this.effect = effect;
      effect.onended = () => {
        effect.disconnect();
        if (this.effect === effect) this.effect = null;
      };
      effect.start();
    } catch {
      // A missing effect must never break the eye or the background music.
    }
  }

  async playDialogue() {
    if (!this.status.enabled || this.status.loading || document.hidden ||
        this.settings.dialogue === 0 || this.voice || this.voiceLoading) return;
    this.voiceLoading = true;
    const request = ++this.voiceRequest;
    const epoch = this.epoch;
    const index = nextDialogueIndex(this.lastDialogue);
    const quote = DIALOGUES[index];
    try {
      const buffer = await this.buffer(quote.src);
      if (epoch !== this.epoch || request !== this.voiceRequest || !this.status.enabled || document.hidden ||
          this.settings.dialogue === 0 || this.context?.state !== 'running') return;
      const voice = this.node(buffer, 'dialogue');
      this.voice = voice;
      this.lastDialogue = index;
      this.update({ quote });
      voice.onended = () => {
        voice.disconnect();
        if (this.voice === voice) {
          this.voice = null;
          this.update({ quote: null });
        }
      };
      voice.start();
      // Music is a separate source: no stop, pause, restart, or ducking here.
    } catch {
      // Skip an unavailable quote and leave the music running.
    } finally {
      this.voiceLoading = false;
    }
  }

  dispose() {
    this.disposed = true;
    this.disable();
    void this.context?.close().catch(() => {});
    this.context = null;
    this.gains = null;
    this.buffers.clear();
  }
}
