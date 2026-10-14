import { fireEvent, render, screen, act } from '@testing-library/react';
import { SiteAudio } from '../site-audio';
import { AUDIO_STORAGE_KEY, SHARINGAN_AUDIO_EVENT } from '@/lib/site-audio-library';
import { SILENT_AUDIO_STATUS, type AudioStatus } from '@/lib/site-audio';

jest.mock('lucide-react', () => ({ Settings2: () => null, Volume2: () => null, VolumeX: () => null, X: () => null }));

const mockEnable = jest.fn();
const mockDisable = jest.fn();
const mockSettings = jest.fn();
const mockDialogue = jest.fn();
const mockEffect = jest.fn();
const mockDispose = jest.fn();
const mockVisibility = jest.fn();
let notify: (status: AudioStatus) => void;
jest.mock('@/lib/site-audio', () => ({
  SILENT_AUDIO_STATUS: { enabled: false, loading: false, error: null, quote: null },
  SiteAudioEngine: jest.fn().mockImplementation((changed) => {
    notify = changed;
    return {
      enable: mockEnable, disable: mockDisable, setSettings: mockSettings,
      playDialogue: mockDialogue, playSharingan: mockEffect,
      dispose: mockDispose, visibilityChanged: mockVisibility,
    };
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  localStorage.clear();
});
afterEach(() => jest.useRealTimers());

test('opt-in controls, saved levels, eye events and cleanup', () => {
  const view = render(<SiteAudio />);
  expect(mockEnable).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Enable site audio' }));
  expect(mockEnable).toHaveBeenCalledTimes(1);
  act(() => notify({ ...SILENT_AUDIO_STATUS, enabled: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Audio settings' }));
  fireEvent.change(screen.getByRole('slider', { name: 'music volume' }), { target: { value: '8' } });
  expect(JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY)!).music).toBe(0.08);
  fireEvent.click(screen.getByRole('button', { name: 'Play a dialogue' }));
  expect(mockDialogue).toHaveBeenCalledTimes(1);
  act(() => window.dispatchEvent(new CustomEvent(SHARINGAN_AUDIO_EVENT, { detail: 'mangekyo' })));
  expect(mockEffect).toHaveBeenCalledWith('mangekyo');
  fireEvent.click(screen.getByRole('button', { name: 'Mute site audio' }));
  expect(mockDisable).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(mockDispose).toHaveBeenCalledTimes(1);
});

test('random dialogue stops when switched off; no automatic sound after remount', () => {
  const view = render(<SiteAudio />);
  act(() => notify({ ...SILENT_AUDIO_STATUS, enabled: true }));
  act(() => jest.advanceTimersByTime(90_000));
  expect(mockDialogue).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Audio settings' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Random character dialogue' }));
  mockDialogue.mockClear();
  act(() => jest.advanceTimersByTime(180_000));
  expect(mockDialogue).not.toHaveBeenCalled();
  view.unmount();
  render(<SiteAudio />);
  expect(mockEnable).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Enable site audio' })).toBeVisible();
});
