import {
  act,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import type { AuthService } from '@/lib/auth/service';
import type { AuthUser } from '@/lib/auth/types';
import { AuthError } from '@/lib/auth/errors';

import { AuthProvider, useAuth } from './AuthContext';

const admin: AuthUser = {
  avatar_url: null,
  email: 'admin@example.test',
  id: 1,
  is_banned: false,
  name: 'Admin',
  role: 'superadmin',
};

function createService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    bootstrap: jest.fn(async () => admin),
    login: jest.fn(async () => ({
      status: 'authenticated' as const,
      user: admin,
    })),
    logout: jest.fn(async () => undefined),
    refreshUser: jest.fn(async () => admin),
    ...overrides,
  };
}

function Probe() {
  const auth = useAuth();
  return (
    <>
      <Text testID="auth-state">
        {JSON.stringify({
          error: auth.error,
          isAdmin: auth.isAdmin,
          isSuperAdmin: auth.isSuperAdmin,
          loading: auth.loading,
          user: auth.user,
        })}
      </Text>
      <Pressable onPress={() => void auth.login()} testID="login" />
      <Pressable onPress={() => void auth.logout()} testID="logout" />
      <Pressable onPress={() => void auth.refreshUser()} testID="refresh" />
    </>
  );
}

function readState(view: Awaited<ReturnType<typeof render>>) {
  return JSON.parse(view.getByTestId('auth-state').props.children as string) as {
    error: string | null;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    loading: boolean;
    user: AuthUser | null;
  };
}

test('hydrates the shared user and derives source role flags', async () => {
  const view = await render(
    <AuthProvider service={createService()}>
      <Probe />
    </AuthProvider>,
  );

  await waitFor(() => expect(readState(view).loading).toBe(false));
  expect(readState(view)).toMatchObject({
    error: null,
    isAdmin: true,
    isSuperAdmin: true,
    user: admin,
  });
});

test('refresh clears a stale user on failure like the web context', async () => {
  const service = createService({
    refreshUser: jest.fn(async () => {
      throw new Error('private network detail');
    }),
  });
  const view = await render(
    <AuthProvider service={service}>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(readState(view).loading).toBe(false));

  await fireEvent.press(view.getByTestId('refresh'));

  await waitFor(() => expect(readState(view).user).toBeNull());
  expect(readState(view).error).toBe('refresh_failed');
});

test('a cancelled browser login leaves the user and error unchanged', async () => {
  const service = createService({
    bootstrap: jest.fn(async () => null),
    login: jest.fn(async () => ({ status: 'cancelled' as const })),
  });
  const view = await render(
    <AuthProvider service={service}>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(readState(view).loading).toBe(false));

  await fireEvent.press(view.getByTestId('login'));

  await waitFor(() => expect(service.login).toHaveBeenCalledTimes(1));
  expect(readState(view)).toMatchObject({ error: null, user: null });
});

test('logout clears the current user after revocation', async () => {
  const service = createService();
  const view = await render(
    <AuthProvider service={service}>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(readState(view).user).toEqual(admin));

  await fireEvent.press(view.getByTestId('logout'));

  await waitFor(() => expect(readState(view).user).toBeNull());
  expect(service.logout).toHaveBeenCalledTimes(1);
});

test('keeps the user visible when logout cannot revoke or clear credentials', async () => {
  const service = createService({
    logout: jest.fn(async () => {
      throw new AuthError('logout_incomplete');
    }),
  });
  const view = await render(
    <AuthProvider service={service}>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(readState(view).user).toEqual(admin));

  await fireEvent.press(view.getByTestId('logout'));

  await waitFor(() => expect(service.logout).toHaveBeenCalledTimes(1));
  expect(readState(view)).toMatchObject({
    error: 'logout_incomplete',
    user: admin,
  });
});

test('does not let a delayed refresh restore the user after logout', async () => {
  let resolveRefresh: (user: AuthUser) => void = () => undefined;
  const service = createService({
    refreshUser: jest.fn(
      () =>
        new Promise<AuthUser>((resolve) => {
          resolveRefresh = resolve;
        }),
    ),
  });
  const view = await render(
    <AuthProvider service={service}>
      <Probe />
    </AuthProvider>,
  );
  await waitFor(() => expect(readState(view).user).toEqual(admin));

  await fireEvent.press(view.getByTestId('refresh'));
  await fireEvent.press(view.getByTestId('logout'));
  await act(async () => resolveRefresh(admin));

  await waitFor(() => expect(service.refreshUser).toHaveBeenCalledTimes(1));
  expect(readState(view).user).toBeNull();
});
