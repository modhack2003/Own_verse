import { fireEvent, render, screen, act } from '@testing-library/react';
import { SiteAudio } from '../site-audio';
import { DEFAULT_AUDIO_SETTINGS, THEME_MUTE_KEY, SHARINGAN_AUDIO_EVENT } from '@/lib/site-audio-library';

jest.mock('lucide-react', () => ({ Volume2: () => null, VolumeX: () => null }));
const mockEnable = jest.fn();
const mockDisable = jest.fn();
const mockSettings = jest.fn();
const mockThemeMute = jest.fn();
const mockUnlock = jest.fn();
const mockEffect = jest.fn();
const mockDispose = jest.fn();
const mockVisibility = jest.fn();
jest.mock('@/lib/site-audio', () => ({
  SiteAudioEngine: jest.fn().mockImplementation(() => ({
    enable: mockEnable, disable: mockDisable, setSettings: mockSettings,
    setThemeMuted: mockThemeMute, unlock: mockUnlock, playSharingan: mockEffect,
    dispose: mockDispose, visibilityChanged: mockVisibility,
  })),
}));
const originalFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks(); jest.useFakeTimers(); localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => DEFAULT_AUDIO_SETTINGS });
});
afterEach(() => { jest.useRealTimers(); global.fetch = originalFetch; });

test('autostarts with admin settings and exposes only a theme mute button', async () => {
  const view = render(<SiteAudio />);
  await act(async () => {});
  expect(mockEnable).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  expect(screen.queryByText('Play a dialogue')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mute theme music' }));
  expect(mockThemeMute).toHaveBeenLastCalledWith(true);
  expect(localStorage.getItem(THEME_MUTE_KEY)).toBe('true');
  expect(mockDisable).not.toHaveBeenCalled();
  act(() => window.dispatchEvent(new CustomEvent(SHARINGAN_AUDIO_EVENT, { detail: 'mangekyo' })));
  expect(mockEffect).toHaveBeenCalledWith('mangekyo');
  fireEvent.pointerDown(window);
  expect(mockUnlock).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Unmute theme music' }));
  expect(mockThemeMute).toHaveBeenLastCalledWith(false);
  view.unmount(); expect(mockDispose).toHaveBeenCalledTimes(1);
});

test('visitor volume overrides are ignored; only theme mute persists', async () => {
  localStorage.setItem('nd-audio-settings-v1', JSON.stringify({ music: 0, dialogue: 0, effects: 0 }));
  localStorage.setItem(THEME_MUTE_KEY, 'true');
  const settings = { ...DEFAULT_AUDIO_SETTINGS, music: 0.4, intervalSeconds: 25 };
  jest.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => settings } as Response);
  render(<SiteAudio />); await act(async () => {});
  expect(mockThemeMute).toHaveBeenCalledWith(true);
  expect(mockSettings).toHaveBeenLastCalledWith(settings);
  expect(screen.getByRole('button', { name: 'Unmute theme music' })).toBeVisible();
});
