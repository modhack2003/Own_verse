import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CollectionEditor } from '../collection-editor';
import { api } from '../api-client';
const toast = jest.fn();
jest.mock('../api-client', () => ({ api: jest.fn(), errorMessage: (e: Error) => e.message }));
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
jest.mock('lucide-react', () => ({ Pencil: () => null, Plus: () => null, RefreshCw: () => null, Trash2: () => null, X: () => null, Loader2: () => null }));

test('collection number fields allow deleting zero and send numbers only at save time', async () => {
  const row = { id: '1', bounty: 0, points: 0, year: 0 };
  jest.mocked(api).mockImplementation(async (_path, options) => options?.method === 'PUT'
    ? { ...row, ...options.body as object } as never : [row] as never);
  render(<CollectionEditor title="Number fields" endpoint="/api/test-numbers"
    fields={['bounty', 'points', 'year'].map(name => ({ name, label: name, type: 'number' as const }))}
    itemTitle={() => 'Entry'} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Entry' }));
  for (const [field, value] of [['bounty', '100'], ['points', '20'], ['year', '2026']]) {
    const input = screen.getByLabelText(field);
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue(null);
    fireEvent.change(input, { target: { value } });
    expect(input).toHaveValue(Number(value));
  }
  fireEvent.change(screen.getByLabelText('points'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/api/test-numbers/1', {
    method: 'PUT', body: { bounty: 100, points: null, year: 2026 },
  }));
});
