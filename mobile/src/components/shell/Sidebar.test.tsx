import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { AuthProvider } from '@/contexts/AuthContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import type { AuthService } from '@/lib/auth/service';
import type { AuthUser } from '@/lib/auth/types';
import { openSafeExternalUrl } from '@/lib/linking';
import { createQueryClient } from '@/lib/query/client';

import { Sidebar } from './Sidebar';

let mockPathname = '/feature/roznama';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  usePathname: () => mockPathname,
}));

jest.mock('@/lib/linking', () => ({
  openSafeExternalUrl: jest.fn(async () => true),
}));

const user: AuthUser = {
  avatar_url: null,
  email: 'member@example.test',
  id: 4,
  is_banned: false,
  name: 'Mobile Member',
  role: 'member',
};

function authService(current: AuthUser | null): AuthService {
  return {
    bootstrap: jest.fn(async () => current),
    login: jest.fn(),
    logout: jest.fn(async () => undefined),
    refreshUser: jest.fn(async () => {
      if (!current) {
        throw new Error('No authenticated user');
      }
      return current;
    }),
  };
}

async function renderSidebar(
  onClose = jest.fn(),
  signedInAs: AuthUser | null = null,
) {
  const tree = (
    <LocaleProvider>
      <AppThemeProvider>
        <Sidebar onClose={onClose} visible />
      </AppThemeProvider>
    </LocaleProvider>
  );
  const view = await render(
    signedInAs ? (
      <AuthProvider queryClient={createQueryClient()} service={authService(signedInAs)}>
        {tree}
      </AuthProvider>
    ) : (
      tree
    ),
  );
  return { onClose, ...view };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPathname = '/feature/roznama';
});

test('lists the website sections in the source order', async () => {
  const view = await renderSidebar();

  expect(
    view.getAllByTestId(/^sidebar-link-/).map((node) => node.props.testID),
  ).toEqual([
    'sidebar-link-syofficial',
    'sidebar-link-roznama',
    'sidebar-link-phonebook',
    'sidebar-link-warnings',
    'sidebar-link-syid',
    'sidebar-link-tierlist',
    'sidebar-link-contributors',
    'sidebar-link-sites',
    'sidebar-link-population',
    'sidebar-link-party',
    'sidebar-link-house',
    'sidebar-link-compass',
    'sidebar-link-priorities',
    'sidebar-link-govapps',
    'sidebar-link-transit',
    'sidebar-link-shawarma',
    'sidebar-link-justice',
    'sidebar-link-places',
    'sidebar-link-board',
  ]);
  expect(view.getByText('الحسابات الرسمية')).toBeTruthy();
  expect(view.getByTestId('sidebar-logo')).toBeTruthy();
});

test('highlights the section of the current route', async () => {
  mockPathname = '/feature/tierlist';
  const view = await renderSidebar();

  expect(
    view.getByTestId('sidebar-link-tierlist').props.accessibilityState,
  ).toEqual({ selected: true });
  expect(
    view.getByTestId('sidebar-link-roznama').props.accessibilityState,
  ).toEqual({ selected: false });
});

test('highlights Transit from any of its nested routes', async () => {
  mockPathname = '/transit/city/damascus';
  const view = await renderSidebar();

  expect(
    view.getByTestId('sidebar-link-transit').props.accessibilityState,
  ).toEqual({ selected: true });
});

test('navigates to a section and closes the sheet', async () => {
  const view = await renderSidebar();

  await fireEvent.press(view.getByTestId('sidebar-link-phonebook'));

  expect(view.onClose).toHaveBeenCalledTimes(1);
  expect(router.push).toHaveBeenCalledWith({
    params: { slug: 'phonebook' },
    pathname: '/feature/[slug]',
  });
});

test('sends Board and Transit to their own native routes', async () => {
  const view = await renderSidebar();

  await fireEvent.press(view.getByTestId('sidebar-link-board'));
  await fireEvent.press(view.getByTestId('sidebar-link-transit'));

  expect(router.push).toHaveBeenNthCalledWith(1, '/board');
  expect(router.push).toHaveBeenNthCalledWith(2, '/transit');
});

test('opens an external link through the safe linking helper', async () => {
  const view = await renderSidebar();

  expect(
    view.getAllByTestId(/^sidebar-external-/).map((node) => node.props.testID),
  ).toEqual([
    'sidebar-external-news',
    'sidebar-external-answers',
    'sidebar-external-joory',
    'sidebar-external-jard',
    'sidebar-external-recipes',
    'sidebar-external-codex-community',
    'sidebar-external-flag-replacer',
  ]);

  await fireEvent.press(view.getByTestId('sidebar-external-news'));

  expect(openSafeExternalUrl).toHaveBeenCalledWith('https://news.jard.chat');
  expect(view.onClose).toHaveBeenCalledTimes(1);
});

test('keeps the three small links of the source sheet', async () => {
  const view = await renderSidebar();

  await fireEvent.press(view.getByTestId('sidebar-footer-about'));
  expect(router.push).toHaveBeenCalledWith('/about');

  await fireEvent.press(view.getByTestId('sidebar-footer-privacy'));
  expect(router.push).toHaveBeenCalledWith({
    params: { slug: 'privacy' },
    pathname: '/feature/[slug]',
  });
  expect(view.getByText('الشروط والأحكام')).toBeTruthy();
});

test('closes from the backdrop and from the close button', async () => {
  const view = await renderSidebar();

  await fireEvent.press(view.getByTestId('sidebar-backdrop'));
  await fireEvent.press(view.getByTestId('sidebar-close'));

  expect(view.onClose).toHaveBeenCalledTimes(2);
});

test('offers Google sign-in while signed out', async () => {
  const view = await renderSidebar();

  expect(view.getByTestId('sidebar-sign-in')).toBeTruthy();
  expect(view.queryByTestId('user-nav-trigger')).toBeNull();
});

test('shows the account menu once a session exists', async () => {
  const view = await renderSidebar(jest.fn(), user);

  expect(await view.findByTestId('user-nav-trigger')).toBeTruthy();
  expect(view.queryByTestId('sidebar-sign-in')).toBeNull();
});
