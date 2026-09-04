import { fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider, useAppTheme } from '@/contexts/ThemeContext';

import { ThemeToggle } from './ThemeToggle';

function ActiveThemeProbe() {
  const { theme } = useAppTheme();
  return <AppText>active:{theme.id}</AppText>;
}

async function renderOpenSheet() {
  const view = await render(
    <LocaleProvider>
      <AppThemeProvider>
        <ThemeToggle />
        <ActiveThemeProbe />
      </AppThemeProvider>
    </LocaleProvider>,
  );
  await fireEvent.press(view.getByLabelText('تغيير المظهر واللغة'));
  return view;
}

test('groups system and standard themes apart from heritage like the website', async () => {
  const view = await renderOpenSheet();

  expect(view.getByText('المظاهر الأساسية')).toBeTruthy();
  expect(view.getByText('التراث السوري')).toBeTruthy();

  const standard = within(view.getByTestId('theme-group-standard'));
  expect(standard.getAllByRole('radio')).toHaveLength(7);
  expect(standard.getByText('🌓 تلقائي (حسب الجهاز)')).toBeTruthy();

  const heritage = within(view.getByTestId('theme-group-heritage'));
  expect(heritage.getAllByRole('radio')).toHaveLength(2);
  expect(heritage.getByText('🌹 الورد الدمشقي')).toBeTruthy();
  expect(heritage.getByText('🌸 ياسمين')).toBeTruthy();
});

test('draws each swatch with the registry background and a primary half circle', async () => {
  const view = await renderOpenSheet();

  expect(
    StyleSheet.flatten(view.getByTestId('theme-swatch-dark-blue').props.style),
  ).toMatchObject({ backgroundColor: '#0f1520', borderColor: '#4d84f5' });
  expect(
    StyleSheet.flatten(
      view.getByTestId('theme-swatch-fill-dark-blue').props.style,
    ),
  ).toMatchObject({ backgroundColor: '#4d84f5', height: '50%' });
});

test('splits only the system swatch into a light and a dark half', async () => {
  const view = await renderOpenSheet();

  expect(
    StyleSheet.flatten(view.getByTestId('theme-swatch-split-system').props.style),
  ).toMatchObject({ backgroundColor: '#1a1f22', width: '50%' });
  expect(view.queryByTestId('theme-swatch-split-light')).toBeNull();
});

test('selecting a theme repaints the sheet with that theme palette', async () => {
  const view = await renderOpenSheet();

  await fireEvent.press(view.getByText('🔵 داكن أزرق'));

  expect(view.getByText('active:dark-blue')).toBeTruthy();
  expect(
    StyleSheet.flatten(view.getByTestId('theme-sheet').props.style),
  ).toMatchObject({ backgroundColor: '#0f141f' });
});

test('keeps the language switch and localizes the group headings', async () => {
  const view = await renderOpenSheet();

  await fireEvent.press(view.getByText('English'));

  expect(view.getByText('العربية')).toBeTruthy();
  expect(view.getByText('Standard')).toBeTruthy();
  expect(view.getByText('Syrian Heritage')).toBeTruthy();
});
