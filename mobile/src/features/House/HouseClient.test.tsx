import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { fetchHouseData } from './data';
import HouseClient from './HouseClient';

jest.mock('./data', () => ({
  ...jest.requireActual('./data'),
  fetchHouseData: jest.fn(),
}));

const response = {
  headers: [
    'Name',
    'Place',
    'Sex',
    'Age',
    'المهنة',
    'أسماء جديدة',
  ],
  rows: [
    {
      Age: '42',
      Name: 'أحمد',
      Place: 'دمشق',
      Sex: 'أنثى',
      'أسماء جديدة': 'نور، ليث',
      المهنة: 'طبيب',
      __ageGroup: '40s',
      __appealStatus: 'مطعون',
      __nameNorm: 'احمد',
      __placeNorm: 'دمشق',
      __sexNorm: 'أنثى',
    },
    {
      Age: '55',
      Name: 'سامر',
      Place: 'حلب',
      Sex: 'ذكر',
      'أسماء جديدة': '',
      المهنة: 'مهندس',
      __ageGroup: '50s',
      __appealStatus: '',
      __nameNorm: 'سامر',
      __placeNorm: 'حلب',
      __sexNorm: 'ذكر',
    },
  ],
};

async function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: 0, networkMode: 'always', retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <AppThemeProvider>
          <HouseClient />
        </AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchHouseData).mockResolvedValue(response);
});

test('renders source attribution, statistics, charts, new names, and dynamic cells', async () => {
  const view = await renderScreen();

  await waitFor(() => expect(view.getByText('طبيب')).toBeTruthy());
  expect(view.getByText('المصدر: اللجنة العليا للانتخابات')).toBeTruthy();
  expect(view.getByText('نور')).toBeTruthy();
  expect(view.getByText('ليث')).toBeTruthy();
  expect(view.getByTestId('house-sex-chart')).toBeTruthy();
  expect(view.getByTestId('house-age-chart')).toBeTruthy();
  expect(view.getAllByText('50.0%')).toHaveLength(3);
  expect(view.getAllByText('المهنة').length).toBeGreaterThan(1);
  expect(view.getByText('مهندس')).toBeTruthy();
});

test('applies native sex and appeal controls without losing the full record', async () => {
  const view = await renderScreen();

  await waitFor(() => expect(view.getByText('سامر')).toBeTruthy());
  await fireEvent.press(view.getByTestId('house-sex-female'));
  expect(view.queryByText('سامر')).toBeNull();
  expect(view.getByText('أحمد')).toBeTruthy();

  await fireEvent.press(view.getByTestId('house-appeal-clean'));
  expect(view.queryByText('أحمد')).toBeNull();
  expect(view.getByText('لا توجد بيانات مطابقة')).toBeTruthy();
});

test('keeps cached records visible when a refresh fails', async () => {
  jest
    .mocked(fetchHouseData)
    .mockResolvedValueOnce(response)
    .mockRejectedValueOnce(new Error('private upstream response'));
  const view = await renderScreen();

  await waitFor(() => expect(view.getByText('أحمد')).toBeTruthy());
  const refreshControl = view.container.queryAll(
    (instance) => instance.type === 'RCTRefreshControl',
  )[0];
  expect(refreshControl).toBeDefined();
  await fireEvent(refreshControl!, 'refresh');
  await waitFor(() =>
    expect(
      view.getByText('يتم عرض آخر بيانات المجلس المحفوظة لأن التحديث تعذر.'),
    ).toBeTruthy(),
  );
  expect(view.getByText('أحمد')).toBeTruthy();
  expect(view.queryByText('private upstream response')).toBeNull();
});

test('shows a safe retry state when no cached response exists', async () => {
  jest
    .mocked(fetchHouseData)
    .mockRejectedValue(new Error('private upstream response'));
  const view = await renderScreen();

  await waitFor(() =>
    expect(
      view.getByText(
        'تعذر تحميل بيانات المجلس. حاول مرة أخرى عند توفر الاتصال.',
      ),
    ).toBeTruthy(),
  );
  expect(view.queryByText('private upstream response')).toBeNull();
});

function makeRows(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const name = `عضو ${String(index + 1).padStart(2, '0')}`;
    return {
      Age: '42',
      Name: name,
      __ageGroup: '40s',
      __appealStatus: '',
      __nameNorm: name,
      __placeNorm: 'دمشق',
      __sexNorm: 'ذكر',
    };
  });
}

test('records load the next window instead of paging back and forth', async () => {
  jest.mocked(fetchHouseData).mockResolvedValue({
    headers: ['Name', 'Age'],
    rows: makeRows(42),
  });
  const view = await renderScreen();

  await waitFor(() => expect(view.getByText('عضو 01')).toBeTruthy());
  expect(view.getByText('عرض 40 من أصل 42 سجل')).toBeTruthy();
  expect(view.queryByText('عضو 41')).toBeNull();

  await fireEvent.press(view.getByTestId('house-load-more'));
  expect(view.getByText('عضو 41')).toBeTruthy();
  expect(view.getByText('عرض 42 من أصل 42 سجل')).toBeTruthy();
  expect(view.queryByTestId('house-load-more')).toBeNull();
});

test('the winners district picker searches instead of scrolling every district', async () => {
  const districtKey = 'Electoral District (الدائرة الانتخابية)';
  jest.mocked(fetchHouseData).mockResolvedValue({
    headers: ['Name', districtKey, 'Sex', 'Age'],
    rows: [
      {
        Age: '42',
        Name: 'فائز دمشق',
        [districtKey]: 'دمشق',
        Sex: 'ذكر',
        __ageGroup: '40s',
        __appealStatus: '',
        __nameNorm: 'فائز دمشق',
        __placeNorm: 'دمشق',
        __sexNorm: 'ذكر',
      },
      {
        Age: '51',
        Name: 'فائز حلب',
        [districtKey]: 'حلب',
        Sex: 'أنثى',
        __ageGroup: '50s',
        __appealStatus: '',
        __nameNorm: 'فائز حلب',
        __placeNorm: 'حلب',
        __sexNorm: 'أنثى',
      },
    ],
  });
  const view = await renderScreen();

  await fireEvent.press(view.getByTestId('house-mode-winners'));
  await waitFor(() => expect(view.getByText('فائز حلب')).toBeTruthy());

  await fireEvent.press(view.getByTestId('house-district-picker'));
  await fireEvent.changeText(
    view.getByTestId('house-district-search'),
    'حلب',
  );
  expect(view.queryByTestId('house-district-option-دمشق')).toBeNull();
  await fireEvent.press(view.getByTestId('house-district-option-حلب'));

  expect(view.getByText('فائز حلب')).toBeTruthy();
  expect(view.queryByText('فائز دمشق')).toBeNull();
  expect(view.getByLabelText('الدائرة الانتخابية: حلب')).toBeTruthy();
});
