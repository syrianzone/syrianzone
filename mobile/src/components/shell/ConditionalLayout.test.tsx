import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ConditionalLayout } from './ConditionalLayout';

let mockPathname = '/';

jest.mock('expo-router', () => ({
  usePathname: () => mockPathname,
}));

jest.mock('./Navbar', () => {
  const { Text: NativeText } = jest.requireActual<
    typeof import('react-native')
  >('react-native');

  return {
    Navbar: () => <NativeText>native navbar</NativeText>,
  };
});

jest.mock('@/components/UnblockSyriaNotification', () => {
  const { Text: NativeText } = jest.requireActual<
    typeof import('react-native')
  >('react-native');

  function MockUnblockSyriaNotification() {
    return <NativeText>unblock notice</NativeText>;
  }

  return MockUnblockSyriaNotification;
});

beforeEach(() => {
  mockPathname = '/';
});

test('hides the navbar on the start page', async () => {
  const view = await render(
    <ConditionalLayout>
      <Text>start page</Text>
    </ConditionalLayout>,
  );

  expect(view.queryByText('native navbar')).toBeNull();
  expect(view.getByText('unblock notice')).toBeTruthy();
});

test('hides the unblock notice throughout Transit', async () => {
  mockPathname = '/transit/city/damascus';
  const view = await render(
    <ConditionalLayout>
      <Text>transit page</Text>
    </ConditionalLayout>,
  );

  expect(view.getByText('native navbar')).toBeTruthy();
  expect(view.queryByText('unblock notice')).toBeNull();
});
