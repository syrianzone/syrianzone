import { fireEvent, render } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { Avatar } from './Avatar';

jest.mock('expo-image', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );

  return {
    Image: (props: object) => React.createElement(View, props),
  };
});

function wrapper(uri: string | null) {
  return (
    <LocaleProvider>
      <AppThemeProvider>
        <Avatar label="ليلى" uri={uri} />
      </AppThemeProvider>
    </LocaleProvider>
  );
}

test('uses initials when no avatar URL exists', async () => {
  const view = await render(wrapper(null));

  expect(view.getByText('ل')).toBeTruthy();
  expect(view.queryByTestId('avatar-image')).toBeNull();
});

test('falls back to initials when the remote image fails', async () => {
  const view = await render(wrapper('https://media.example/avatar.webp'));

  await fireEvent(view.getByTestId('avatar-image'), 'error');

  expect(view.queryByTestId('avatar-image')).toBeNull();
  expect(view.getByText('ل')).toBeTruthy();
});

test('retries after the avatar URL changes', async () => {
  const view = await render(wrapper('https://media.example/old.webp'));
  await fireEvent(view.getByTestId('avatar-image'), 'error');

  await view.rerender(wrapper('https://media.example/new.webp'));

  expect(view.getByTestId('avatar-image')).toBeTruthy();
});
