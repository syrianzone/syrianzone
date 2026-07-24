import { render } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { Text } from 'react-native';

import TransitLayout from './layout';

jest.mock('./_components/layout/Header', () => ({
  TransitHeader: () => {
    const { Text: NativeText } = jest.requireActual<
      typeof import('react-native')
    >('react-native');
    return <NativeText>transit header</NativeText>;
  },
}));

jest.mock('./_components/TransitThemeContext', () => ({
  TransitThemeProvider: ({ children }: PropsWithChildren) => children,
}));

jest.mock('./_providers/QueryProvider', () => ({
  QueryProvider: ({ children }: PropsWithChildren) => children,
}));

test('mounts the Transit header with routed page content', async () => {
  const view = await render(
    <TransitLayout>
      <Text>city page</Text>
    </TransitLayout>,
  );

  expect(view.getByText('transit header')).toBeTruthy();
  expect(view.getByText('city page')).toBeTruthy();
});
