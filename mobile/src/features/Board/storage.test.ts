import AsyncStorage from '@react-native-async-storage/async-storage';

import { createDefaultDocument } from './model';
import {
  BOARD_DOCUMENT_KEY,
  BOARD_PREVIOUS_KEY,
  clearPreviousDocument,
  readBoardDocument,
  readPreviousDocument,
  writeBoardDocument,
  writePreviousDocument,
} from './storage';

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('round trips the current and previous documents through AsyncStorage', async () => {
  const current = createDefaultDocument();
  const previous = { ...current, updatedAt: '2026-07-23T10:00:00.000Z' };

  await writeBoardDocument(current);
  await writePreviousDocument(previous);

  expect(await readBoardDocument()).toEqual(current);
  expect(await readPreviousDocument()).toEqual(previous);
  expect(await AsyncStorage.getItem(BOARD_DOCUMENT_KEY)).toBe(JSON.stringify(current));
  expect(await AsyncStorage.getItem(BOARD_PREVIOUS_KEY)).toBe(JSON.stringify(previous));

  await clearPreviousDocument();
  expect(await readPreviousDocument()).toBeNull();
});

test('returns null for corrupt storage and never throws when storage fails', async () => {
  await AsyncStorage.setItem(BOARD_DOCUMENT_KEY, '{broken');
  expect(await readBoardDocument()).toBeNull();

  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disabled'));
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
  await expect(readBoardDocument()).resolves.toBeNull();
  await expect(writeBoardDocument(createDefaultDocument())).resolves.toBe(false);
});

test('isolates guest and account Board documents on a shared device', async () => {
  const guest = createDefaultDocument();
  const accountA = {
    ...guest,
    activeId: 'account-a',
    dashboards: [{ id: 'account-a', name: 'Account A', widgets: [] }],
  };
  const accountB = {
    ...guest,
    activeId: 'account-b',
    dashboards: [{ id: 'account-b', name: 'Account B', widgets: [] }],
  };

  await writeBoardDocument(guest);
  await writeBoardDocument(accountA, 7);
  await writeBoardDocument(accountB, 8);

  expect(await readBoardDocument()).toEqual(guest);
  expect(await readBoardDocument(7)).toEqual(accountA);
  expect(await readBoardDocument(8)).toEqual(accountB);
  expect(await readBoardDocument(9)).toBeNull();
});
