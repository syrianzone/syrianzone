import { render } from '@testing-library/react-native';
import { useState } from 'react';
import { Text } from 'react-native';

import { AccountBoundary } from './AccountBoundary';

let mockIdentity: number | null = 7;

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockIdentity === null ? null : { id: mockIdentity },
  }),
}));

function PrivateDraft() {
  const [ownerId] = useState(mockIdentity);
  return <Text>private draft owner {ownerId ?? 'guest'}</Text>;
}

test('remounts the screen subtree when the authenticated identity changes', async () => {
  mockIdentity = 7;
  const tree = () => (
    <AccountBoundary>
      <PrivateDraft />
    </AccountBoundary>
  );
  const view = await render(tree());

  expect(view.getByText('private draft owner 7')).toBeTruthy();

  mockIdentity = 8;
  await view.rerender(tree());

  expect(view.getByText('private draft owner 8')).toBeTruthy();
  expect(view.queryByText('private draft owner 7')).toBeNull();

  mockIdentity = null;
  await view.rerender(tree());

  expect(view.getByText('private draft owner guest')).toBeTruthy();
  expect(view.queryByText('private draft owner 8')).toBeNull();
});
