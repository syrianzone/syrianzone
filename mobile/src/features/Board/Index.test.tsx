import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  act,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { getBoard, putBoard } from './api';
import BoardScreen from './Index';
import {
  BOARD_DOCUMENT_KEY,
  boardDocumentKey,
} from './storage';
import type { BoardDocument } from './types';

let mockUser: { id: number } | null = null;

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('./api', () => ({
  getBoard: jest.fn(),
  putBoard: jest.fn(),
}));

jest.mock('./WidgetRenderer', () => ({
  WidgetRenderer: ({
    instance,
  }: {
    instance: { d: string; i: string };
  }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    const { Text } = jest.requireActual<typeof import('react-native')>(
      'react-native',
    );
    return React.createElement(
      Text,
      { testID: `rendered-${instance.i}` },
      instance.d,
    );
  },
}));

const storedDocument: BoardDocument = {
  activeId: 'd_main',
  dashboards: [
    {
      id: 'd_main',
      name: 'الرئيسية',
      widgets: [
        { c: { text: 'مرحبا' }, d: 'notes', h: 4, i: 'w_notes', w: 4 },
        { c: { future: true }, d: 'future-widget', h: 3, i: 'w_future', w: 6 },
      ],
    },
  ],
  updatedAt: '2026-07-24T10:00:00.000Z',
  v: 1,
};

async function renderScreen() {
  return render(
    <LocaleProvider>
      <AppThemeProvider>
        <BoardScreen />
      </AppThemeProvider>
    </LocaleProvider>,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockUser = null;
  await AsyncStorage.clear();
  await AsyncStorage.setItem(
    BOARD_DOCUMENT_KEY,
    JSON.stringify(storedDocument),
  );
  jest.mocked(getBoard).mockResolvedValue({
    document: null,
    updated_at: null,
  });
  jest.mocked(putBoard).mockResolvedValue({
    updated_at: '2026-07-24T10:01:00.000Z',
  });
});

test('manages multiple dashboards and preserves unknown widgets', async () => {
  const view = await renderScreen();

  await waitFor(() => expect(view.getByText('future-widget')).toBeTruthy());
  await fireEvent.press(view.getByText('تخصيص'));
  await fireEvent.press(view.getByLabelText('لوحة جديدة'));
  expect(view.getByText('لوحة 2')).toBeTruthy();

  await fireEvent.press(view.getByLabelText('إعادة تسمية اللوحة'));
  await fireEvent.changeText(view.getByTestId('board-dashboard-name'), 'العمل');
  await fireEvent.press(view.getByText('حفظ'));
  expect(view.getByText('العمل')).toBeTruthy();

  await fireEvent.press(view.getByText('الرئيسية'));
  await fireEvent.press(view.getByLabelText('حذف اللوحة'));
  expect(view.queryByText('الرئيسية')).toBeNull();
  expect(view.getByText('العمل')).toBeTruthy();

  await waitFor(async () => {
    const value = await AsyncStorage.getItem(BOARD_DOCUMENT_KEY);
    expect(JSON.parse(value ?? '{}').dashboards).toHaveLength(1);
  });
});

test('adds, reorders, discretely resizes, configures, and removes widgets', async () => {
  const view = await renderScreen();

  await waitFor(() => expect(view.getByText('notes')).toBeTruthy());
  await fireEvent.press(view.getByText('تخصيص'));
  await fireEvent.press(view.getByText('إضافة'));
  await fireEvent.press(view.getByTestId('board-add-transit-cities'));
  expect(view.getByText('المواصلات')).toBeTruthy();

  await fireEvent.press(view.getByText('إضافة'));
  await fireEvent.press(view.getByTestId('board-add-clock'));
  expect(view.getByText('الساعة')).toBeTruthy();

  await fireEvent.press(view.getByLabelText('نقل الساعة للأعلى'));
  const rendered = view.getAllByTestId(/^rendered-/);
  expect(rendered.at(-2)?.props.children).toBe('clock');

  await fireEvent.press(view.getByLabelText('تغيير حجم الساعة'));
  await fireEvent.press(view.getByText('كامل'));
  expect(view.getByText('12 × 2')).toBeTruthy();

  await fireEvent.press(view.getByLabelText('إعدادات الساعة'));
  await fireEvent.press(view.getByText('12 ساعة'));
  await fireEvent.press(view.getByText('إغلاق'));

  await fireEvent.press(view.getByLabelText('حذف المواصلات'));
  expect(view.queryByText('المواصلات')).toBeNull();
});

test('switches Board layout and notes to the next account scope before syncing', async () => {
  const accountA: BoardDocument = {
    activeId: 'account-a',
    dashboards: [
      {
        id: 'account-a',
        name: 'Account A',
        widgets: [
          {
            c: { text: 'Private A note' },
            d: 'notes',
            h: 4,
            i: 'account-a-note',
            w: 4,
          },
        ],
      },
    ],
    updatedAt: '2026-07-24T10:00:00.000Z',
    v: 1,
  };
  const accountB: BoardDocument = {
    activeId: 'account-b',
    dashboards: [
      {
        id: 'account-b',
        name: 'Account B',
        widgets: [],
      },
    ],
    updatedAt: '2026-07-24T10:01:00.000Z',
    v: 1,
  };
  await AsyncStorage.setItem(
    boardDocumentKey(7),
    JSON.stringify(accountA),
  );
  await AsyncStorage.setItem(
    boardDocumentKey(8),
    JSON.stringify(accountB),
  );
  mockUser = { id: 7 };
  const view = await renderScreen();

  await waitFor(() => expect(view.getByText('Account A')).toBeTruthy());
  await waitFor(() =>
    expect(putBoard).toHaveBeenCalledWith(accountA, expect.anything()),
  );
  jest.clearAllMocks();
  jest.mocked(getBoard).mockResolvedValue({
    document: null,
    updated_at: null,
  });
  jest.mocked(putBoard).mockResolvedValue({
    updated_at: '2026-07-24T10:02:00.000Z',
  });

  mockUser = { id: 8 };
  await act(async () => {
    view.rerender(
      <LocaleProvider>
        <AppThemeProvider>
          <BoardScreen />
        </AppThemeProvider>
      </LocaleProvider>,
    );
  });

  await waitFor(() => expect(view.getByText('Account B')).toBeTruthy());
  expect(view.queryByText('Account A')).toBeNull();
  await waitFor(() =>
    expect(putBoard).toHaveBeenCalledWith(accountB, expect.anything()),
  );
  expect(putBoard).not.toHaveBeenCalledWith(accountA, expect.anything());
});

test('promotes the guest board to the account on the first sign-in', async () => {
  mockUser = { id: 11 };
  const view = await renderScreen();

  await waitFor(() => expect(view.getByText('الرئيسية')).toBeTruthy());
  expect(view.getByText('future-widget')).toBeTruthy();
  await waitFor(() =>
    expect(putBoard).toHaveBeenCalledWith(storedDocument, expect.anything()),
  );
  await waitFor(async () => {
    const value = await AsyncStorage.getItem(boardDocumentKey(11));
    expect(JSON.parse(value ?? 'null')).toEqual(storedDocument);
  });
});

test('lets an existing server document win over the promoted guest board', async () => {
  const serverDocument: BoardDocument = {
    activeId: 'server',
    dashboards: [{ id: 'server', name: 'لوحة الخادم', widgets: [] }],
    updatedAt: '2026-07-24T11:00:00.000Z',
    v: 1,
  };
  jest.mocked(getBoard).mockResolvedValue({
    document: serverDocument,
    updated_at: serverDocument.updatedAt,
  });
  mockUser = { id: 12 };
  const view = await renderScreen();

  await waitFor(() => expect(view.getByText('لوحة الخادم')).toBeTruthy());
  expect(view.queryByText('الرئيسية')).toBeNull();
  // the guest board is superseded, not dropped
  expect(view.getByText('استعادة النسخة السابقة')).toBeTruthy();
});

test('does not promote the guest board again once the account has its own', async () => {
  const accountDocument: BoardDocument = {
    activeId: 'account',
    dashboards: [{ id: 'account', name: 'لوحة الحساب', widgets: [] }],
    updatedAt: '2026-07-24T09:00:00.000Z',
    v: 1,
  };
  await AsyncStorage.setItem(
    boardDocumentKey(13),
    JSON.stringify(accountDocument),
  );
  mockUser = { id: 13 };
  const view = await renderScreen();

  await waitFor(() => expect(view.getByText('لوحة الحساب')).toBeTruthy());
  expect(view.queryByText('الرئيسية')).toBeNull();
  await waitFor(() =>
    expect(putBoard).toHaveBeenCalledWith(accountDocument, expect.anything()),
  );
  expect(putBoard).not.toHaveBeenCalledWith(storedDocument, expect.anything());
});

test('keeps a number config draft while typing and clamps it on blur', async () => {
  await AsyncStorage.setItem(
    BOARD_DOCUMENT_KEY,
    JSON.stringify({
      ...storedDocument,
      dashboards: [
        {
          id: 'd_main',
          name: 'الرئيسية',
          widgets: [
            { c: { limit: 8 }, d: 'answers', h: 3, i: 'w_answers', w: 6 },
          ],
        },
      ],
    }),
  );
  const view = await renderScreen();

  await waitFor(() => expect(view.getByText('answers')).toBeTruthy());
  await fireEvent.press(view.getByText('تخصيص'));
  await fireEvent.press(view.getByLabelText('إعدادات إجابات سوريا'));
  expect(view.getByTestId('board-config-limit').props.value).toBe('8');

  // 1 is below the minimum of 3 but is the first keystroke of 15
  await fireEvent.changeText(view.getByTestId('board-config-limit'), '1');
  expect(view.getByTestId('board-config-limit').props.value).toBe('1');
  await fireEvent.changeText(view.getByTestId('board-config-limit'), '15');
  expect(view.getByTestId('board-config-limit').props.value).toBe('15');

  await fireEvent.changeText(view.getByTestId('board-config-limit'), '99');
  await fireEvent(view.getByTestId('board-config-limit'), 'blur');
  expect(view.getByTestId('board-config-limit').props.value).toBe('20');
  await waitFor(async () => {
    const value = await AsyncStorage.getItem(BOARD_DOCUMENT_KEY);
    expect(JSON.parse(value ?? '{}').dashboards[0].widgets[0].c.limit).toBe(20);
  });
});
