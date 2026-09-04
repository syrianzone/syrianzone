import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { Navbar } from './Navbar';

let mockCanGoBack = false;

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: () => mockCanGoBack,
    push: jest.fn(),
    replace: jest.fn(),
  },
  usePathname: () => '/feature/roznama',
}));

jest.mock('@/lib/linking', () => ({
  openSafeExternalUrl: jest.fn(async () => true),
}));

async function renderNavbar() {
  return render(
    <LocaleProvider>
      <AppThemeProvider>
        <Navbar />
      </AppThemeProvider>
    </LocaleProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCanGoBack = false;
});

test('shows the logo alone between the menu and the account buttons', async () => {
  const view = await renderNavbar();

  expect(view.getByTestId('navbar-logo')).toBeTruthy();
  expect(view.queryByText('المساحة السورية')).toBeNull();
  expect(view.getByTestId('navbar-menu')).toBeTruthy();
  expect(view.getByTestId('navbar-account')).toBeTruthy();

  await fireEvent.press(view.getByTestId('navbar-account'));
  expect(router.push).toHaveBeenCalledWith('/account');
});

test('opens the sidebar from the hamburger button', async () => {
  const view = await renderNavbar();

  expect(view.queryByTestId('sidebar-panel')).toBeNull();

  await fireEvent.press(view.getByTestId('navbar-menu'));

  expect(view.getByTestId('sidebar-panel')).toBeTruthy();
  expect(view.getByTestId('sidebar-link-syofficial')).toBeTruthy();
});

test('closing the sidebar leaves the bar untouched', async () => {
  const view = await renderNavbar();
  await fireEvent.press(view.getByTestId('navbar-menu'));

  await fireEvent.press(view.getByTestId('sidebar-close'));

  expect(view.queryByTestId('sidebar-panel')).toBeNull();
  expect(view.getByTestId('navbar-logo')).toBeTruthy();
});

test('keeps the back button only while the stack can pop', async () => {
  const withoutHistory = await renderNavbar();
  expect(withoutHistory.queryByTestId('navbar-back')).toBeNull();

  mockCanGoBack = true;
  const withHistory = await renderNavbar();
  await fireEvent.press(withHistory.getByTestId('navbar-back'));

  expect(router.back).toHaveBeenCalledTimes(1);
});
