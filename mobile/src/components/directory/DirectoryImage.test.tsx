import { fireEvent, render } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { DirectoryImage } from './DirectoryImage';

test('falls back from a store icon to first-party media, then a placeholder', async () => {
  const view = await render(
    <LocaleProvider>
      <AppThemeProvider>
        <DirectoryImage
          accessibilityLabel="أيقونة التطبيق"
          fallbackUri="https://syrian.zone/assets/apps/app/icon.png"
          uri="https://cdn.example.com/store-icon.png"
        />
      </AppThemeProvider>
    </LocaleProvider>,
  );

  await fireEvent(view.getByLabelText('أيقونة التطبيق'), 'error', {
    nativeEvent: {},
  });
  expect(view.queryByLabelText('أيقونة التطبيق: صورة غير متاحة')).toBeNull();

  await fireEvent(view.getByLabelText('أيقونة التطبيق'), 'error', {
    nativeEvent: {},
  });
  const retry = view.getByLabelText('أيقونة التطبيق: صورة غير متاحة');
  expect(retry).toBeTruthy();
  await fireEvent.press(retry);
  expect(view.getByLabelText('أيقونة التطبيق')).toBeTruthy();
});

test('localizes unavailable and retry labels for feature-owned languages', async () => {
  const view = await render(
    <LocaleProvider>
      <AppThemeProvider>
        <DirectoryImage
          accessibilityLabel="App icon"
          retryLabel="Retry image"
          unavailableLabel="Image unavailable"
          uri="https://cdn.example.com/broken.png"
        />
      </AppThemeProvider>
    </LocaleProvider>,
  );

  await fireEvent(view.getByLabelText('App icon'), 'error', {
    nativeEvent: {},
  });
  expect(view.getByLabelText('App icon: Image unavailable')).toBeTruthy();
  expect(view.getByText('Retry image')).toBeTruthy();
});
