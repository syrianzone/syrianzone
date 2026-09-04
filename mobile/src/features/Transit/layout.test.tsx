import { render } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { Text } from 'react-native';

import TransitLayout from './layout';

jest.mock('./_components/TransitThemeContext', () => ({
  TransitThemeProvider: ({ children }: PropsWithChildren) => children,
}));

jest.mock('./_providers/QueryProvider', () => ({
  QueryProvider: ({ children }: PropsWithChildren) => children,
}));

test('mounts routed Transit pages without header chrome of its own', async () => {
  const view = await render(
    <TransitLayout>
      <Text>city page</Text>
    </TransitLayout>,
  );

  expect(view.getByText('city page')).toBeTruthy();
  expect(view.queryByRole('button')).toBeNull();
});
