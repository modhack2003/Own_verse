import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AudioPanel } from '../audio-panel';
import { api } from '../api-client';
import { DEFAULT_AUDIO_SETTINGS, DIALOGUES } from '@/lib/site-audio-library';
jest.mock('../api-client', () => ({ api: jest.fn(), errorMessage: (e: Error) => e.message }));
jest.mock('lucide-react', () => ({ Loader2: () => null }));
beforeEach(() => { jest.clearAllMocks(); jest.mocked(api).mockResolvedValue(DEFAULT_AUDIO_SETTINGS); });

test('edits shared levels and playlist and persists them through the protected API', async () => {
  const { container } = render(<AudioPanel />);
  await screen.findByRole('button', { name: 'Save audio settings' });
  expect(container.querySelectorAll('audio')).toHaveLength(DIALOGUES.length);
  fireEvent.change(screen.getByRole('slider', { name: 'music volume' }), { target: { value: '65' } });
  fireEvent.change(screen.getByLabelText('Gap after each dialogue (seconds)'), { target: { value: '30' } });
  fireEvent.click(screen.getAllByRole('checkbox')[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Save audio settings' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/api/site-audio', { method: 'PUT', body: {
    ...DEFAULT_AUDIO_SETTINGS, music: 0.65, intervalSeconds: 30,
    enabledDialogueIds: DEFAULT_AUDIO_SETTINGS.enabledDialogueIds.slice(1),
  } }));
  expect(await screen.findByRole('status')).toHaveTextContent('saved for all visitors');
});

test('a failed load cannot overwrite unknown saved settings with defaults', async () => {
  jest.mocked(api).mockRejectedValue(new Error('Settings unavailable'));
  render(<AudioPanel />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Settings unavailable');
  expect(screen.queryByRole('button', { name: 'Save audio settings' })).not.toBeInTheDocument();
});
