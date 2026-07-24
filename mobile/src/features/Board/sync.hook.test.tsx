import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Button, Text, View } from 'react-native';

import { getBoard, putBoard } from './api';
import { BOARD_SAVE_DEBOUNCE_MS, useBoardSync } from './sync';
import { boardPreviousKey } from './storage';
import type { BoardDocument } from './types';

jest.mock('./api', () => ({
  getBoard: jest.fn(),
  putBoard: jest.fn(),
}));

const local: BoardDocument = {
  activeId: 'local',
  dashboards: [{ id: 'local', name: 'محلية', widgets: [] }],
  updatedAt: '2026-07-24T10:00:00.000Z',
  v: 1,
};
const server: BoardDocument = {
  activeId: 'server',
  dashboards: [{ id: 'server', name: 'خادم', widgets: [] }],
  updatedAt: '2026-07-24T10:01:00.000Z',
  v: 1,
};

function Harness({ hadLocal = true }: { hadLocal?: boolean }) {
  const [document, setDocument] = useState(local);
  const sync = useBoardSync({
    accountId: 7,
    document,
    enabled: true,
    hadLocal,
    onAdopt: setDocument,
  });
  return (
    <View>
      <Text testID="active">{document.activeId}</Text>
      <Text testID="status">{sync.status}</Text>
      <Text testID="superseded">{sync.superseded?.activeId ?? ''}</Text>
      <Button
        onPress={() =>
          setDocument((current) => ({
            ...current,
            dashboards: [{ ...current.dashboards[0]!, name: 'معدلة' }],
            updatedAt: '2026-07-24T10:02:00.000Z',
          }))
        }
        title="mutate"
      />
      <Button onPress={sync.restore} title="restore" />
    </View>
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  jest.mocked(putBoard).mockResolvedValue({
    updated_at: '2026-07-24T10:02:01.000Z',
  });
});

afterEach(() => {
  jest.useRealTimers();
});

test('adopts a newer server document and preserves the local loser for restore', async () => {
  jest.mocked(getBoard).mockResolvedValue({
    document: server,
    updated_at: server.updatedAt,
  });
  const view = await render(<Harness />);

  await waitFor(() => expect(view.getByTestId('active').props.children).toBe('server'));
  expect(view.getByTestId('superseded').props.children).toBe('local');
  expect(
    JSON.parse((await AsyncStorage.getItem(boardPreviousKey(7))) ?? '{}'),
  ).toEqual(local);

  await fireEvent.press(view.getByText('restore'));
  await waitFor(() => expect(view.getByTestId('active').props.children).toBe('local'));
  expect(await AsyncStorage.getItem(boardPreviousKey(7))).toBeNull();
});

test('keeps a newer local document, saves it, and offers the server loser for restore', async () => {
  const olderServer = {
    ...server,
    updatedAt: '2026-07-24T09:59:00.000Z',
  };
  jest.mocked(getBoard).mockResolvedValue({
    document: olderServer,
    updated_at: olderServer.updatedAt,
  });
  const view = await render(<Harness hadLocal />);

  await waitFor(() =>
    expect(view.getByTestId('superseded').props.children).toBe('server'),
  );
  expect(view.getByTestId('active').props.children).toBe('local');
  await waitFor(() =>
    expect(putBoard).toHaveBeenCalledWith(local, expect.anything()),
  );

  await fireEvent.press(view.getByText('restore'));
  await waitFor(() =>
    expect(view.getByTestId('active').props.children).toBe('server'),
  );
});

test('debounces subsequent edits and saves the latest full document', async () => {
  jest.useFakeTimers();
  jest.mocked(getBoard).mockResolvedValue({
    document: local,
    updated_at: local.updatedAt,
  });
  const view = await render(<Harness hadLocal={false} />);

  await waitFor(() => expect(view.getByTestId('active').props.children).toBe('local'));
  expect(putBoard).not.toHaveBeenCalled();

  await fireEvent.press(view.getByText('mutate'));
  await act(async () => {
    jest.advanceTimersByTime(BOARD_SAVE_DEBOUNCE_MS - 1);
  });
  expect(putBoard).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  await waitFor(() => expect(putBoard).toHaveBeenCalledTimes(1));
  expect(putBoard).toHaveBeenCalledWith(
    expect.objectContaining({
      dashboards: [
        expect.objectContaining({ name: 'معدلة' }),
      ],
    }),
    expect.anything(),
  );
});

test('offers a persisted previous document for restore after an app restart', async () => {
  await AsyncStorage.setItem(boardPreviousKey(7), JSON.stringify(server));
  jest.mocked(getBoard).mockResolvedValue({
    document: local,
    updated_at: local.updatedAt,
  });
  const view = await render(<Harness />);

  await waitFor(() =>
    expect(view.getByTestId('superseded').props.children).toBe('server'),
  );
  await fireEvent.press(view.getByText('restore'));
  await waitFor(() =>
    expect(view.getByTestId('active').props.children).toBe('server'),
  );
});

test('does not drain a queued save after the account-scoped hook unmounts', async () => {
  jest.useFakeTimers();
  jest.mocked(getBoard).mockResolvedValue({
    document: local,
    updated_at: local.updatedAt,
  });
  let resolveSave:
    | ((value: { updated_at: string }) => void)
    | undefined;
  jest.mocked(putBoard).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
  );
  const view = await render(<Harness hadLocal={false} />);

  await waitFor(() =>
    expect(view.getByTestId('active').props.children).toBe('local'),
  );
  await fireEvent.press(view.getByText('mutate'));
  await act(async () => {
    jest.advanceTimersByTime(BOARD_SAVE_DEBOUNCE_MS);
  });
  expect(putBoard).toHaveBeenCalledTimes(1);

  await fireEvent.press(view.getByText('mutate'));
  await act(async () => {
    jest.advanceTimersByTime(BOARD_SAVE_DEBOUNCE_MS);
  });
  expect(putBoard).toHaveBeenCalledTimes(1);

  const saveSignal = jest.mocked(putBoard).mock.calls[0]?.[1];
  await act(async () => {
    view.unmount();
  });
  expect(saveSignal?.aborted).toBe(true);
  await act(async () => {
    resolveSave?.({ updated_at: '2026-07-24T10:03:00.000Z' });
  });

  expect(putBoard).toHaveBeenCalledTimes(1);
});
