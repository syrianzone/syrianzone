import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import { openSafeExternalUrl } from '@/lib/linking';

import About from './About';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/lib/linking', () => ({
  openSafeExternalUrl: jest.fn(async () => true),
}));

function renderAbout() {
  return render(
    <LocaleProvider>
      <AppThemeProvider>
        <About />
      </AppThemeProvider>
    </LocaleProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('ships the CC BY 4.0 attribution for the bundled Streamline icons', async () => {
  const view = await renderAbout();

  expect(
    view.getByText(/Creative Commons Attribution 4.0 International \(CC BY 4.0\)/),
  ).toBeTruthy();
});

test('credits every contributor the website lists, including @abd_hmh', async () => {
  const view = await renderAbout();

  expect(view.getByText(/عبدالرحمن حداد \(@abd_hmh\)/)).toBeTruthy();
  expect(view.getByText(/مكدوس \(@macdoos\)/)).toBeTruthy();
  expect(view.getByText(/يوري دندشي \(@yuri.dandashi\)/)).toBeTruthy();
});

test('switches to the English tab the website kept', async () => {
  const view = await renderAbout();

  await fireEvent.press(view.getByText('English'));

  expect(view.getByText(/Non-commercial open-source community platform/)).toBeTruthy();
  expect(view.getByText(/Abdulrahman Haddad \(@abd_hmh\)/)).toBeTruthy();
  expect(view.queryByText(/مبادرة تفاعلية مفتوحة وغير تجارية/)).toBeNull();
});

test('opens the repository link through the safe URL guard', async () => {
  const view = await renderAbout();

  await fireEvent.press(view.getByText('المستودع على GitHub'));

  expect(openSafeExternalUrl).toHaveBeenCalledWith(
    'https://github.com/syrianzone/syrianzone',
  );
});

test('routes the footer to the native privacy and terms screens', async () => {
  const view = await renderAbout();

  await fireEvent.press(view.getByText('سياسة الخصوصية | Privacy Policy'));
  await fireEvent.press(view.getByText('الشروط والأحكام | Terms & Conditions'));

  expect(router.push).toHaveBeenCalledWith('/feature/privacy');
  expect(router.push).toHaveBeenCalledWith('/feature/terms');
});
