import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { placesApi } from '../_lib/api';
import { GuidesTab } from './GuidesTab';

jest.mock('../_lib/api', () => ({
  placesApi: { guides: jest.fn() },
}));

async function renderGuides(onSelectGuide = jest.fn()) {
  return {
    onSelectGuide,
    view: await render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } })}>
      <LocaleProvider>
        <AppThemeProvider>
          <GuidesTab onSelectGuide={onSelectGuide} />
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(placesApi.guides).mockImplementation(async (sort) => ({
    guides: [{
      approved_count: 4,
      avatar_url: null,
      name: sort === 'saves' ? 'سلمى' : 'ليلى',
      level: sort === 'saves' ? 3 : 2,
      points: sort === 'saves' ? 84 : 52,
      rank: 1,
      recent_count: 2,
      saves_total: sort === 'saves' ? 18 : 7,
      user_id: sort === 'saves' ? 6 : 5,
    }],
    sort,
  }));
});

test('starts with points and switches among every ranking metric', async () => {
  const { view } = await renderGuides();

  await waitFor(() => expect(view.getByText('ليلى')).toBeTruthy());
  expect(placesApi.guides).toHaveBeenCalledWith('points');
  expect(view.getByText('52 نقطة · 4 مساهمة · 7 حفظ')).toBeTruthy();
  expect(view.getByLabelText('جوّال، المستوى 2')).toBeTruthy();
  await fireEvent.press(view.getByText('الأكثر حفظاً'));

  await waitFor(() => expect(view.getByText('سلمى')).toBeTruthy());
  expect(placesApi.guides).toHaveBeenLastCalledWith('saves');
  expect(view.getByText('84 نقطة · 4 مساهمة · 18 حفظ')).toBeTruthy();

  await fireEvent.press(view.getByText('الأكثر مساهمة'));
  await waitFor(() => expect(placesApi.guides).toHaveBeenLastCalledWith('submissions'));

  await fireEvent.press(view.getByText('النشطون مؤخراً'));
  await waitFor(() => expect(placesApi.guides).toHaveBeenLastCalledWith('recent'));
  await waitFor(() => expect(view.getByText('52 نقطة · 4 مساهمة · 7 حفظ · 2 خلال 30 يوماً')).toBeTruthy());
});

test('offers a retry when the guide request fails', async () => {
  jest.mocked(placesApi.guides)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ guides: [], sort: 'points' });
  const { view } = await renderGuides();

  await waitFor(() => expect(view.getByText('تعذر تحميل المرشدين')).toBeTruthy());
  await fireEvent.press(view.getByText('إعادة المحاولة'));

  await waitFor(() => expect(view.getByText('لا يوجد مساهمون بعد')).toBeTruthy());
  expect(placesApi.guides).toHaveBeenCalledTimes(2);
});

test('opens a guide profile and filters the map from its action', async () => {
  const { onSelectGuide, view } = await renderGuides();

  await waitFor(() => expect(view.getByText('ليلى')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('فتح ملف ليلى'));

  expect(view.getByText('52')).toBeTruthy();
  expect(view.getByText('نقطة')).toBeTruthy();
  expect(view.getAllByText('جوّال').length).toBeGreaterThan(0);
  expect(view.getByText('4')).toBeTruthy();
  expect(view.getByText('مساهمة')).toBeTruthy();
  await fireEvent.press(view.getByText('عرض المساهمات على الخريطة'));

  expect(onSelectGuide).toHaveBeenCalledWith({ id: 5, name: 'ليلى' });
});

test('shows the exact Mishwar rank ladder', async () => {
  const { view } = await renderGuides();

  await fireEvent.press(view.getByText('الرتب'));

  expect(view.getByText('مستويات مشوار')).toBeTruthy();
  expect(view.getByText('النقاط المطلوبة')).toBeTruthy();
  expect(view.getByText('مبتدئ')).toBeTruthy();
  expect(view.getByLabelText('رقم المستوى 3')).toBeTruthy();
  expect(view.getByText('مرشد محلي')).toBeTruthy();
  expect(view.getByText('وزير السياحة')).toBeTruthy();
  expect(view.getByText('100000')).toBeTruthy();
  expect(view.getByText(/مكان مقبول: 15 نقطة/)).toBeTruthy();
});
