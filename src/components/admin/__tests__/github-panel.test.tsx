import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GitHubPanel } from '../github-panel';
import { api } from '../api-client';
const toast = jest.fn();
jest.mock('../api-client', () => ({ api: jest.fn(), errorMessage: (e: Error) => e.message }));
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
jest.mock('lucide-react', () => ({ ExternalLink: () => null, GitFork: () => null, Pin: () => null, RefreshCw: () => null, Star: () => null, Trash2: () => null, Loader2: () => null }));
const repo = { id: '1', name: 'repo', fullName: 'owner/repo', customTitle: null, customDescription: null, customTags: [], displayOrder: null, displayInPortfolio: false, language: 'TypeScript', pushedAt: '2024-01-01' };
test('checks for automatic refresh and labels repos hidden from the public site', async () => {
  jest.mocked(api).mockImplementation(async (path) => {
    if (path === '/api/personal-data') return { github: 'https://github.com/owner' } as never;
    if (path === '/api/github/sync') return { skipped: true, data: null } as never;
    return { repositories: [repo], stats: { lastSync: null, lastError: null } } as never;
  });
  render(<GitHubPanel />);
  expect(await screen.findByText('hidden from site')).toBeVisible();
  await waitFor(() => expect(api).toHaveBeenCalledWith('/api/github/sync', { method: 'POST', body: { automatic: true } }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Sync now' })).toBeEnabled());
  expect(screen.getByRole('switch', { name: 'Show repo on the site' })).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByRole('button', { name: 'Refresh list' })).toBeEnabled();
});

test('a zero repository pin position can be cleared and saved as automatic ordering', async () => {
  jest.clearAllMocks();
  jest.mocked(api).mockImplementation(async (path, options) => {
    if (path === '/api/personal-data') return null as never;
    if (path === '/api/github/sync') return { skipped: true, data: null } as never;
    if (options?.method === 'PUT') return { repository: { ...repo, displayOrder: null } } as never;
    return { repositories: [{ ...repo, displayOrder: 0 }], stats: { lastSync: null, lastError: null } } as never;
  });
  render(<GitHubPanel />);
  const edit = await screen.findByRole('button', { name: 'Customize' });
  await waitFor(() => expect(edit).toBeEnabled());
  fireEvent.click(edit);
  const position = screen.getByLabelText('Pin position');
  expect(position).toHaveValue(0);
  fireEvent.change(position, { target: { value: '' } });
  expect(position).toHaveValue(null);
  fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/api/github/repos/1', {
    method: 'PUT', body: { customTitle: '', customDescription: '', customTags: [], displayOrder: null },
  }));
});
