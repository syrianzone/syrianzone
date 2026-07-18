import { fireEvent, render } from '@testing-library/react-native';

import { AppText } from '@/components/ui/AppText';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { DirectoryScreen } from './DirectoryScreen';

function renderScreen(
  props: Partial<React.ComponentProps<typeof DirectoryScreen>> = {},
) {
  return render(
    <LocaleProvider>
      <AppThemeProvider>
        <DirectoryScreen
          subtitle="وصف الدليل"
          title="عنوان الدليل"
          {...props}
        >
          <AppText>بيانات محفوظة</AppText>
        </DirectoryScreen>
      </AppThemeProvider>
    </LocaleProvider>,
  );
}

test('renders a labeled loading state', async () => {
  const view = await renderScreen({
    isLoading: true,
    loadingLabel: 'جاري تحميل الدليل...',
  });

  expect(view.getByLabelText('جاري تحميل الدليل...')).toBeTruthy();
  expect(view.queryByText('بيانات محفوظة')).toBeNull();
});

test('renders an error with a working retry action', async () => {
  const onRetry = jest.fn();
  const view = await renderScreen({
    errorDetail: 'تعذر تحميل الدليل.',
    onRetry,
  });

  await fireEvent.press(view.getByText('إعادة المحاولة'));
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(view.getByText('تعذر تحميل الدليل.')).toBeTruthy();
});

test('uses feature-owned error and retry labels', async () => {
  const onRetry = jest.fn();
  const view = await renderScreen({
    errorDetail: 'The directory could not load.',
    errorTitle: 'Could not load data',
    onRetry,
    retryLabel: 'Retry',
  });

  expect(view.getByText('Could not load data')).toBeTruthy();
  await fireEvent.press(view.getByText('Retry'));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test('keeps cached content visible with a refresh warning', async () => {
  const view = await renderScreen({
    cachedWarning: 'يتم عرض آخر بيانات محفوظة.',
  });

  expect(view.getByText('يتم عرض آخر بيانات محفوظة.')).toBeTruthy();
  expect(view.getByText('بيانات محفوظة')).toBeTruthy();
});

test('distinguishes a valid empty directory from an error', async () => {
  const view = await renderScreen({
    empty: true,
    emptyDetail: 'لا توجد سجلات بعد.',
    emptyTitle: 'الدليل فارغ',
  });

  expect(view.getByText('الدليل فارغ')).toBeTruthy();
  expect(view.getByText('لا توجد سجلات بعد.')).toBeTruthy();
  expect(view.queryByText('تعذر تحميل الدليل.')).toBeNull();
});
