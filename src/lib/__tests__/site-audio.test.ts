import { SiteAudioEngine, type AudioStatus } from '../site-audio';
import { DEFAULT_AUDIO_SETTINGS, DIALOGUES, MUSIC_TRACK, nextDialogueIndex, parseAudioSettings } from '../site-audio-library';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const sources: Array<{
  buffer: { duration: number } | null; loop: boolean;
  connect: jest.Mock; disconnect: jest.Mock; start: jest.Mock; stop: jest.Mock;
  onended: (() => void) | null;
}> = [];
const gains: Array<{ gain: { value: number; setTargetAtTime: jest.Mock; setValueAtTime: jest.Mock; cancelScheduledValues: jest.Mock; linearRampToValueAtTime: jest.Mock }; connect: jest.Mock }> = [];
const resume = jest.fn().mockResolvedValue(undefined);
const suspend = jest.fn().mockResolvedValue(undefined);
const close = jest.fn().mockResolvedValue(undefined);
const originalFetch = global.fetch;
const originalContext = window.AudioContext;
let statuses: AudioStatus[] = [];
let engine: SiteAudioEngine;

beforeEach(() => {
  jest.useFakeTimers();
  sources.length = 0;
  gains.length = 0;
  statuses = [];
  jest.clearAllMocks();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  window.AudioContext = jest.fn().mockImplementation(() => ({
    currentTime: 12,
    state: 'running',
    destination: {},
    resume, suspend, close,
    decodeAudioData: jest.fn().mockResolvedValue({ duration: 160 }),
    createDynamicsCompressor: () => ({ threshold: {}, knee: {}, ratio: {}, attack: {}, release: {}, connect: jest.fn() }),
    createGain: () => {
      const gain = { gain: { value: 1, setTargetAtTime: jest.fn(), setValueAtTime: jest.fn(), cancelScheduledValues: jest.fn(), linearRampToValueAtTime: jest.fn() }, connect: jest.fn() };
      gains.push(gain);
      return gain;
    },
    createBufferSource: () => {
      const source = {
        buffer: null, loop: false, connect: jest.fn(), disconnect: jest.fn(),
        start: jest.fn(), stop: jest.fn(), onended: null,
      };
      sources.push(source);
      return source;
    },
  }));
  global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
  engine = new SiteAudioEngine((status) => statuses.push(status));
});
afterEach(() => {
  engine.dispose();
  global.fetch = originalFetch;
  window.AudioContext = originalContext;
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  jest.useRealTimers();
});

test('silent until opt-in; independent louder dialogue leaves looping music running', async () => {
  expect(global.fetch).not.toHaveBeenCalled();
  expect(window.AudioContext).not.toHaveBeenCalled();
  await engine.enable();
  expect(sources).toHaveLength(1);
  expect(sources[0].loop).toBe(true);
  expect(gains[0].gain.value).toBe(0);
  expect(gains[0].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.75, 16);
  expect(gains[1].gain.value).toBe(1);
  await engine.playDialogue();
  expect(sources).toHaveLength(2);
  expect(sources[0].stop).not.toHaveBeenCalled();
  expect(sources[0].start).toHaveBeenCalledTimes(1);
  expect(statuses.at(-1)?.quote).toBeTruthy();
  // A second request cannot stack another voice on the current dialogue.
  await engine.playDialogue();
  expect(sources).toHaveLength(2);
  sources[1].onended?.();
  expect(statuses.at(-1)?.quote).toBeNull();
});

test('mute stops music, voice and effects; returning to the page stays silent', async () => {
  await engine.enable();
  await engine.playDialogue();
  await engine.playSharingan('mangekyo');
  engine.disable();
  expect(sources.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  await engine.visibilityChanged();
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  await engine.visibilityChanged();
  expect(resume).toHaveBeenCalledTimes(1);
  expect(statuses.at(-1)?.enabled).toBe(false);
});

test('late music cannot start after the visitor mutes while loading', async () => {
  let finish!: (value: Response) => void;
  jest.mocked(global.fetch).mockImplementation((url) => String(url) === MUSIC_TRACK
    ? new Promise((resolve) => { finish = resolve; }) as Promise<Response>
    : Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) } as Response));
  const starting = engine.enable();
  engine.disable();
  finish({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) } as Response);
  await starting;
  expect(sources).toHaveLength(0);
  expect(statuses.at(-1)?.enabled).toBe(false);
});

test('background tabs suspend the mixer and cancel speech; resume keeps the same music source', async () => {
  await engine.enable();
  await engine.playDialogue();
  const music = sources[0];
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  await engine.visibilityChanged();
  expect(suspend).toHaveBeenCalled();
  expect(sources[1].stop).toHaveBeenCalled();
  await engine.playDialogue();
  await engine.playSharingan('sharingan');
  expect(sources).toHaveLength(2);
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  await engine.visibilityChanged();
  expect(resume).toHaveBeenCalledTimes(2);
  expect(music.stop).not.toHaveBeenCalled();
  expect(music.start).toHaveBeenCalledTimes(1);
});

test('missing music leaves an honest retry state; effect failures do not stop music', async () => {
  jest.mocked(global.fetch).mockImplementation((url) => Promise.resolve({
    ok: String(url) !== MUSIC_TRACK, arrayBuffer: async () => new ArrayBuffer(1),
  } as Response));
  await engine.enable();
  expect(statuses.at(-1)?.enabled).toBe(false);
  expect(statuses.at(-1)?.error).toMatch(/retry/);
  expect(sources).toHaveLength(0);
  jest.mocked(global.fetch).mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) } as Response);
  await engine.enable();
  expect(statuses.at(-1)?.enabled).toBe(true);
  expect(statuses.at(-1)?.loading).toBe(false);
  engine.setSettings({ ...DEFAULT_AUDIO_SETTINGS, effects: 0 });
  await engine.playSharingan('mangekyo');
  expect(sources).toHaveLength(1);
  expect(sources[0].stop).not.toHaveBeenCalled();
});

test('dialogues never immediately repeat and saved settings are validated', () => {
  for (let previous = 0; previous < DIALOGUES.length; previous++) {
    for (const random of [0, 0.2, 0.5, 0.999]) {
      expect(nextDialogueIndex(previous, random)).not.toBe(previous);
    }
  }
  expect(parseAudioSettings('broken')).toEqual(DEFAULT_AUDIO_SETTINGS);
  expect(parseAudioSettings('{"music":9,"dialogue":-1,"effects":"loud","randomDialogue":false}'))
    .toEqual({ ...DEFAULT_AUDIO_SETTINGS, music: 1, dialogue: 0, effects: 0.95, randomDialogue: false });
});

test('the shipped playlist, looping theme, and both eye effects resolve to nonempty local assets', () => {
  for (const src of [MUSIC_TRACK, '/audio/mangekyo.mp3', '/audio/sharingan.mp3', ...DIALOGUES.map((quote) => quote.src)]) {
    const file = join(process.cwd(), 'public', src);
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeGreaterThan(1_000);
  }
});

test('turning off dialogue cancels a voice still being downloaded', async () => {
  await engine.enable();
  let finish!: (value: Response) => void;
  jest.mocked(global.fetch).mockImplementation(() => new Promise((resolve) => { finish = resolve; }) as Promise<Response>);
  const playing = engine.playDialogue();
  engine.setSettings({ ...DEFAULT_AUDIO_SETTINGS, randomDialogue: false });
  finish({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) } as Response);
  await playing;
  expect(sources).toHaveLength(1);
});

test('theme mute leaves voices and eye effects active', async () => {
  await engine.enable();
  engine.setThemeMuted(true);
  expect(gains[0].gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 12.05);
  await engine.playDialogue();
  await engine.playSharingan('mangekyo');
  expect(sources).toHaveLength(3);
  expect(gains[1].gain.value).toBe(1);
  expect(gains[2].gain.value).toBe(0.95);
  expect(sources[0].stop).not.toHaveBeenCalled();
});

test.each([3, 23])('waits 20 seconds AFTER a %s-second recording finishes', async seconds => {
  await engine.enable();
  await jest.advanceTimersByTimeAsync(19_999);
  expect(sources).toHaveLength(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(sources).toHaveLength(2);
  await jest.advanceTimersByTimeAsync(seconds * 1000);
  expect(sources).toHaveLength(2);
  sources[1].onended?.();
  await jest.advanceTimersByTimeAsync(19_999);
  expect(sources).toHaveLength(2);
  await jest.advanceTimersByTimeAsync(1);
  expect(sources).toHaveLength(3);
  expect(sources[0].stop).not.toHaveBeenCalled();
});

test('settings refresh does not reset an existing gap; disabled clips cannot be selected', async () => {
  await engine.enable();
  await jest.advanceTimersByTimeAsync(10_000);
  engine.setSettings({ ...DEFAULT_AUDIO_SETTINGS });
  await jest.advanceTimersByTimeAsync(10_000);
  expect(sources).toHaveLength(2);
  expect(nextDialogueIndex(0, 0.5, [])).toBe(-1);
  expect(nextDialogueIndex(0, 0.5, [DIALOGUES[4].id])).toBe(4);
  expect(nextDialogueIndex(4, 0.5, [DIALOGUES[4].id])).toBe(4);
});

test('a real gesture unlocks a pending autoplay attempt without starting duplicate music', async () => {
  let allow!: () => void;
  resume.mockImplementationOnce(() => new Promise<void>(resolve => { allow = resolve; }));
  const starting = engine.enable();
  const context = jest.mocked(window.AudioContext).mock.results[0].value;
  context.state = 'suspended';
  engine.unlock();
  expect(resume).toHaveBeenCalledTimes(2);
  context.state = 'running'; allow();
  await starting;
  expect(sources.filter(s => s.loop)).toHaveLength(1);
});
