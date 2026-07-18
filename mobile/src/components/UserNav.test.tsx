import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AuthProvider } from '@/contexts/AuthContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import type { AuthService } from '@/lib/auth/service';
import type { AuthUser } from '@/lib/auth/types';

import UserNav from './UserNav';

const admin: AuthUser = {
  avatar_url: null,
  email: 'admin@example.test',
  id: 8,
  is_banned: false,
  name: 'Mobile Admin',
  role: 'admin',
};

function createService(user: AuthUser | null): AuthService {
  return {
    bootstrap: jest.fn(async () => user),
    login: jest.fn(),
    logout: jest.fn(async () => undefined),
    refreshUser: jest.fn(async () => {
      if (!user) {
        throw new Error('No authenticated user');
      }
      return user;
    }),
  };
}

async function renderNav(user: AuthUser | null, props = {}) {
  const service = createService(user);
  const view = await render(
    <LocaleProvider>
      <AppThemeProvider>
        <AuthProvider service={service}>
          <UserNav {...props} />
        </AuthProvider>
      </AppThemeProvider>
    </LocaleProvider>,
  );

  return {
    service,
    ...view,
  };
}

test('renders nothing without a signed-in user', async () => {
  const view = await renderNav(null);

  await waitFor(() =>
    expect(view.queryByTestId('user-nav-trigger')).toBeNull(),
  );
});

test('shows the source account actions and invokes native callbacks', async () => {
  const onOpenDashboard = jest.fn();
  const onOpenPolls = jest.fn();
  const onOpenProfile = jest.fn();
  const view = await renderNav(admin, {
    onOpenDashboard,
    onOpenPolls,
    onOpenProfile,
  });
  await waitFor(() => expect(view.getByTestId('user-nav-trigger')).toBeTruthy());

  await fireEvent.press(view.getByTestId('user-nav-trigger'));

  expect(view.getByText(admin.name)).toBeTruthy();
  expect(view.getByText(admin.email)).toBeTruthy();
  await fireEvent.press(view.getByTestId('user-nav-dashboard'));
  await fireEvent.press(view.getByTestId('user-nav-trigger'));
  await fireEvent.press(view.getByTestId('user-nav-polls'));
  await fireEvent.press(view.getByTestId('user-nav-trigger'));
  await fireEvent.press(view.getByTestId('user-nav-profile'));
  expect(onOpenDashboard).toHaveBeenCalledTimes(1);
  expect(onOpenPolls).toHaveBeenCalledTimes(1);
  expect(onOpenProfile).toHaveBeenCalledTimes(1);
});

test('keeps the dashboard but hides poll administration for a member', async () => {
  const member: AuthUser = { ...admin, id: 11, role: 'member' };
  const view = await renderNav(member);
  await waitFor(() => expect(view.getByTestId('user-nav-trigger')).toBeTruthy());

  await fireEvent.press(view.getByTestId('user-nav-trigger'));

  expect(view.getByTestId('user-nav-dashboard')).toBeTruthy();
  expect(view.queryByTestId('user-nav-polls')).toBeNull();
  expect(view.getByTestId('user-nav-profile')).toBeTruthy();
});

test('logout revokes the session and removes the account menu', async () => {
  const view = await renderNav(admin);
  await waitFor(() => expect(view.getByTestId('user-nav-trigger')).toBeTruthy());
  await fireEvent.press(view.getByTestId('user-nav-trigger'));

  await fireEvent.press(view.getByTestId('user-nav-logout'));

  await waitFor(() =>
    expect(view.queryByTestId('user-nav-trigger')).toBeNull(),
  );
  expect(view.service.logout).toHaveBeenCalledTimes(1);
});
