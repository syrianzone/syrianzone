import { Fragment, type PropsWithChildren } from 'react';

import { useAuth } from '@/contexts/AuthContext';

export function AccountBoundary({ children }: PropsWithChildren) {
  const { user } = useAuth();

  return <Fragment key={user?.id ?? 'guest'}>{children}</Fragment>;
}
