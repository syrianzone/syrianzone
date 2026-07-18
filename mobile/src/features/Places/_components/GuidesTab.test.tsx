import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { placesApi } from '../_lib/api';
import { GuidesTab } from './GuidesTab';

jest.mock('../_lib/api', () => ({
  placesApi: { guides: jest.fn() },
}));

async function renderGuides() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } })}>
      <LocaleProvider>
        <AppThemeProvider>
          <GuidesTab />
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(placesApi.guides).mockImplementation(async (sort) => ({
    guides: [{
      approved_count: 4,
      avatar_url: null,
      name: sort === 'saves' ? 'سلمى' : 'ليلى',
      rank: 1,
      recent_count: 2,
      saves_total: sort === 'saves' ? 18 : 7,
      user_id: sort === 'saves' ? 6 : 5,
    }],
    sort,
  }));
});

test('shows ranked local guides and switches ranking metric', async () => {
  const view = await renderGuides();

  await waitFor(() => expect(view.getByText('ليلى')).toBeTruthy());
  expect(view.getByText('4 مساهمة · 7 حفظ')).toBeTruthy();
  await fireEvent.press(view.getByText('الأكثر حفظاً'));

  await waitFor(() => expect(view.getByText('سلمى')).toBeTruthy());
  expect(placesApi.guides).toHaveBeenLastCalledWith('saves');
  expect(view.getByText('4 مساهمة · 18 حفظ')).toBeTruthy();
});

test('offers a retry when the guide request fails', async () => {
  jest.mocked(placesApi.guides)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ guides: [], sort: 'submissions' });
  const view = await renderGuides();

  await waitFor(() => expect(view.getByText('تعذر تحميل المرشدين')).toBeTruthy());
  await fireEvent.press(view.getByText('إعادة المحاولة'));

  await waitFor(() => expect(view.getByText('لا يوجد مساهمون بعد')).toBeTruthy());
  expect(placesApi.guides).toHaveBeenCalledTimes(2);
});
