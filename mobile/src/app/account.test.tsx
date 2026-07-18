import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import AccountRoute from './account';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/features/Auth/AuthScreen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    AuthScreen: ({ onOpenProfile }: { onOpenProfile: () => void }) => (
      <Pressable onPress={onOpenProfile}><Text>الملف الشخصي</Text></Pressable>
    ),
  };
});

test('routes the account profile action to the dashboard profile tab', async () => {
  const view = await render(<AccountRoute />);

  await fireEvent.press(view.getByText('الملف الشخصي'));

  expect(router.push).toHaveBeenCalledWith({
    params: { slug: 'dashboard', tab: 'profile' },
    pathname: '/feature/[slug]',
  });
});
