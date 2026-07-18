import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { AuthProvider } from '@/contexts/AuthContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';
import type { AuthService } from '@/lib/auth/service';
import type { AuthUser } from '@/lib/auth/types';

import { AuthScreen } from './AuthScreen';

const user: AuthUser = {
  avatar_url: null,
  email: 'admin@example.test',
  id: 3,
  is_banned: false,
  name: 'Admin',
  role: 'admin',
};

function createService(initialUser: AuthUser | null): AuthService {
  return {
    bootstrap: jest.fn(async () => initialUser),
    login: jest.fn(async () => ({
      status: 'authenticated' as const,
      user,
    })),
    logout: jest.fn(async () => undefined),
    refreshUser: jest.fn(async () => {
      if (!initialUser) {
        throw new Error('No authenticated user');
      }
      return initialUser;
    }),
  };
}

async function renderScreen(service: AuthService) {
  return render(
    <LocaleProvider>
      <AppThemeProvider>
        <AuthProvider service={service}>
          <AuthScreen />
        </AuthProvider>
      </AppThemeProvider>
    </LocaleProvider>,
  );
}

test('signs in from the native account screen', async () => {
  const service = createService(null);
  const view = await renderScreen(service);
  await waitFor(() => expect(view.getByTestId('auth-sign-in')).toBeTruthy());

  await fireEvent.press(view.getByTestId('auth-sign-in'));

  await waitFor(() => expect(view.getByTestId('auth-account')).toBeTruthy());
  expect(view.getByText(user.email)).toBeTruthy();
  expect(service.login).toHaveBeenCalledTimes(1);
});

test('shows only a localized safe error when login fails', async () => {
  const service = createService(null);
  service.login = jest.fn(async () => {
    throw new Error('secret provider response');
  });
  const view = await renderScreen(service);
  await waitFor(() => expect(view.getByTestId('auth-sign-in')).toBeTruthy());

  await fireEvent.press(view.getByTestId('auth-sign-in'));

  await waitFor(() => expect(view.getByTestId('auth-error')).toBeTruthy());
  expect(view.queryByText('secret provider response')).toBeNull();
});

test('does not label a non-admin account as a verified administrator', async () => {
  const member = { ...user, id: 12, role: 'member' };
  const view = await renderScreen(createService(member));

  await waitFor(() => expect(view.getByTestId('auth-account')).toBeTruthy());
  expect(view.queryByText('حساب إداري موثّق')).toBeNull();
});
