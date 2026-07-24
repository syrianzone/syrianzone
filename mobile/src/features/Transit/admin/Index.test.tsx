import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import {
  approveTransitDraft,
  getTransitDrafts,
} from '../api';
import { TRANSIT_ADMIN_PERMISSIONS } from './model';
import TransitAdminScreen from './Index';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../_hooks/useMapData', () => ({
  useMapData: () => ({ data: null }),
}));

jest.mock('../_components/citymap/MapView', () => ({
  TransitMapView: ({
    data,
  }: {
    data: {
      routes: {
        features: readonly {
          properties: { colorIndex: number };
        }[];
      };
    };
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text: MockText } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return React.createElement(
      MockText,
      { testID: 'draft-preview-color' },
      data.routes.features.at(-1)?.properties.colorIndex,
    );
  },
}));

jest.mock('../api', () => ({
  approveTransitDraft: jest.fn(),
  getTransitDrafts: jest.fn(),
  rejectTransitDraft: jest.fn(),
  toggleTransitSubmitterBan: jest.fn(),
}));

jest.mock('./PublishedRoutesPanel', () => ({
  PublishedRoutesPanel: ({
    access,
  }: {
    access: Readonly<Record<string, boolean>>;
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text: MockText, TextInput: MockTextInput } =
      jest.requireActual<typeof import('react-native')>('react-native');
    const [value, setValue] = React.useState('');

    return React.createElement(
      React.Fragment,
      null,
      React.createElement(
        MockText,
        { testID: 'published-access' },
        Object.entries(access)
          .filter(([, enabled]) => enabled)
          .map(([capability]) => capability)
          .sort()
          .join(','),
      ),
      React.createElement(MockTextInput, {
        accessibilityLabel: 'حالة إدارة الخطوط',
        onChangeText: setValue,
        value,
      }),
    );
  },
}));

let mockUser = {
  avatar_url: null,
  email: 'admin@example.com',
  id: 7,
  is_banned: false,
  name: 'مدير',
  permissions: [] as string[],
  role: 'transit_admin',
};

const draft = {
  city: { name_ar: 'دمشق', name_en: 'Damascus' },
  city_id: 'damascus',
  created_at: '2026-07-24T10:00:00Z',
  geojson: {
    features: [
      {
        geometry: {
          coordinates: [[36.2, 33.4], [36.3, 33.5]],
          type: 'LineString',
        },
        properties: {},
        type: 'Feature',
      },
    ],
    type: 'FeatureCollection',
  },
  id: 42,
  name_ar: 'خط مقترح',
  name_en: 'Proposed route',
  notes: null,
  price: 3_000,
  rejection_reason: null,
  status: 'pending' as const,
  user: { id: 9, is_banned: false, name: 'مساهم' },
  user_id: 9,
};

function Providers({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { gcTime: 0 },
      queries: { gcTime: 0, retry: false },
    },
  });
  return (
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <AppThemeProvider>{children}</AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = {
    avatar_url: null,
    email: 'admin@example.com',
    id: 7,
    is_banned: false,
    name: 'مدير',
    permissions: [],
    role: 'transit_admin',
  };
  jest.mocked(useAuth).mockImplementation(() => ({
    clearError: jest.fn(),
    error: null,
    isAdmin: mockUser.role === 'admin',
    isSuperAdmin: mockUser.role === 'superadmin',
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    user: mockUser,
  }));
  jest.mocked(getTransitDrafts).mockResolvedValue([draft]);
  jest.mocked(approveTransitDraft).mockResolvedValue(undefined);
});

test('selects an approval color and uses it in the preview and request', async () => {
  const view = await render(<TransitAdminScreen />, { wrapper: Providers });

  await waitFor(() => expect(view.getByText('خط مقترح')).toBeTruthy());
  fireEvent.press(view.getByLabelText('مراجعة خط مقترح'));
  await waitFor(() =>
    expect(view.getByTestId('draft-preview-color')).toHaveTextContent('0'),
  );

  fireEvent.press(view.getByRole('radio', { name: 'لون المسار 8' }));

  await waitFor(() =>
    expect(view.getByTestId('draft-preview-color')).toHaveTextContent('7'),
  );
  await act(async () => {
    fireEvent.press(view.getByText('موافقة ونشر'));
  });
  await waitFor(() =>
    expect(approveTransitDraft).toHaveBeenCalledWith(42, 7),
  );
  await waitFor(() => expect(getTransitDrafts).toHaveBeenCalledTimes(2));
});

test.each(Object.values(TRANSIT_ADMIN_PERMISSIONS))(
  'admits an ordinary %s permission holder without overfetching drafts',
  async (permission) => {
    mockUser = {
      ...mockUser,
      permissions: [permission],
      role: 'user',
    };

    const view = await render(<TransitAdminScreen />, { wrapper: Providers });

    await waitFor(() =>
      expect(view.getByText('لوحة إدارة الترانزيت')).toBeTruthy(),
    );
    expect(
      view.queryByText('لا يملك هذا الحساب صلاحية إدارة الترانزيت.'),
    ).toBeNull();

    if (permission === TRANSIT_ADMIN_PERMISSIONS.reviewDrafts) {
      await waitFor(() => expect(getTransitDrafts).toHaveBeenCalledTimes(1));
    } else {
      await act(async () => {
        await Promise.resolve();
      });
      expect(getTransitDrafts).not.toHaveBeenCalled();
    }
  },
);

test.each([
  {
    allowed: 'موافقة ونشر',
    denied: 'تأكيد الرفض',
    permission: TRANSIT_ADMIN_PERMISSIONS.approve,
  },
  {
    allowed: 'تأكيد الرفض',
    denied: 'موافقة ونشر',
    permission: TRANSIT_ADMIN_PERMISSIONS.reject,
  },
])(
  'shows only the $permission draft action after a readable draft is selected',
  async ({ allowed, denied, permission }) => {
    mockUser = {
      ...mockUser,
      permissions: [
        TRANSIT_ADMIN_PERMISSIONS.reviewDrafts,
        permission,
      ],
      role: 'user',
    };

    const view = await render(<TransitAdminScreen />, { wrapper: Providers });

    await waitFor(() => expect(view.getByText('خط مقترح')).toBeTruthy());
    fireEvent.press(view.getByLabelText('مراجعة خط مقترح'));

    await waitFor(() => expect(view.getByText(allowed)).toBeTruthy());
    expect(view.queryByText(denied)).toBeNull();
  },
);

test.each([
  {
    label: 'معرف المقترح للموافقة',
    permission: TRANSIT_ADMIN_PERMISSIONS.approve,
  },
  {
    label: 'معرف المقترح للرفض',
    permission: TRANSIT_ADMIN_PERMISSIONS.reject,
  },
])(
  'keeps the $permission action usable without draft-list permission',
  async ({ label, permission }) => {
    mockUser = {
      ...mockUser,
      permissions: [permission],
      role: 'user',
    };

    const view = await render(<TransitAdminScreen />, { wrapper: Providers });

    await waitFor(() => expect(view.getByPlaceholderText(label)).toBeTruthy());
    expect(getTransitDrafts).not.toHaveBeenCalled();
  },
);

test('remounts private draft-action and route state when the account changes', async () => {
  mockUser = {
    ...mockUser,
    permissions: [TRANSIT_ADMIN_PERMISSIONS.viewLogs],
    role: 'user',
  };
  const view = await render(<TransitAdminScreen />, { wrapper: Providers });

  await waitFor(() =>
    expect(view.getByLabelText('حالة إدارة الخطوط')).toBeTruthy(),
  );
  fireEvent.changeText(
    view.getByLabelText('حالة إدارة الخطوط'),
    'private route state',
  );
  await waitFor(() =>
    expect(view.getByLabelText('حالة إدارة الخطوط').props.value).toBe(
      'private route state',
    ),
  );

  mockUser = { ...mockUser, id: 8 };
  view.rerender(<TransitAdminScreen />);
  await waitFor(() =>
    expect(view.getByLabelText('حالة إدارة الخطوط').props.value).toBe(''),
  );

  mockUser = {
    ...mockUser,
    id: 9,
    permissions: [TRANSIT_ADMIN_PERMISSIONS.reject],
  };
  view.rerender(<TransitAdminScreen />);
  await waitFor(() =>
    expect(
      view.getByPlaceholderText('سبب الرفض (اختياري)'),
    ).toBeTruthy(),
  );
  fireEvent.changeText(
    view.getByPlaceholderText('سبب الرفض (اختياري)'),
    'private rejection',
  );
  await waitFor(() =>
    expect(
      view.getByPlaceholderText('سبب الرفض (اختياري)').props.value,
    ).toBe('private rejection'),
  );

  mockUser = { ...mockUser, id: 10 };
  view.rerender(<TransitAdminScreen />);
  await waitFor(() =>
    expect(
      view.getByPlaceholderText('سبب الرفض (اختياري)').props.value,
    ).toBe(''),
  );
});

test('discards cached draft details when review permission is removed', async () => {
  mockUser = {
    ...mockUser,
    permissions: [
      TRANSIT_ADMIN_PERMISSIONS.reject,
      TRANSIT_ADMIN_PERMISSIONS.reviewDrafts,
    ],
    role: 'user',
  };
  const view = await render(<TransitAdminScreen />, { wrapper: Providers });

  await waitFor(() => expect(view.getByText('خط مقترح')).toBeTruthy());
  fireEvent.press(view.getByLabelText('مراجعة خط مقترح'));
  await waitFor(() =>
    expect(view.getByText('المساهم: مساهم')).toBeTruthy(),
  );
  fireEvent.changeText(
    view.getByPlaceholderText('سبب الرفض (اختياري)'),
    'private rejection',
  );
  await waitFor(() =>
    expect(
      view.getByPlaceholderText('سبب الرفض (اختياري)').props.value,
    ).toBe('private rejection'),
  );

  mockUser = {
    ...mockUser,
    permissions: [TRANSIT_ADMIN_PERMISSIONS.reject],
  };
  view.rerender(<TransitAdminScreen />);

  await waitFor(() =>
    expect(view.getByText('رفض مقترح بالمعرف')).toBeTruthy(),
  );
  expect(view.queryByText('المساهم: مساهم')).toBeNull();
  expect(view.queryByLabelText('مراجعة خط مقترح')).toBeNull();
  expect(
    view.getByPlaceholderText('سبب الرفض (اختياري)').props.value,
  ).toBe('');
});
