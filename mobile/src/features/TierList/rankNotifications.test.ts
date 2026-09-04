import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PollLeaderboard, PollRanking } from '@/lib/api/polls';
import type {
  NotificationChecker,
  NotificationPayload,
} from '@/lib/notifications/checkers';

import {
  createTierlistRankChecker,
  rankSnapshotKey,
  tierlistRankChecker,
} from './rankNotifications';

type Rankings = Pick<PollLeaderboard, 'rankings'>;

const day = () => Date.parse('2026-09-04T09:00:00Z');

function ranking(title: string, rank: number): PollRanking {
  return {
    archiveReason: null,
    avg: 0,
    candidateId: `candidate-${title}`,
    category: null,
    groupId: 'government',
    imageUrl: null,
    name: `اسم ${title}`,
    rank,
    score: 10,
    status: 'active',
    successorId: null,
    termEndedAt: null,
    termStartedAt: null,
    title: `وزير ${title}`,
    votes: 4,
  };
}

function leaderboard(...rows: PollRanking[]): Rankings {
  return { rankings: { government: rows } };
}

// Each call hands back the next leaderboard, so one checker can be run twice over changing data.
function checkerOver(first: Rankings, ...rest: Rankings[]): NotificationChecker {
  const queue = [first, ...rest];
  let current = first;
  return createTierlistRankChecker({
    fetchLeaderboard: async () => {
      current = queue.shift() ?? current;
      return current;
    },
    now: day,
  });
}

async function notify(checker: NotificationChecker): Promise<NotificationPayload> {
  const [payload] = await checker.run();
  if (!payload) {
    throw new Error('the checker reported no change');
  }
  return payload;
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('declares the rank changes checker contract', () => {
  expect(tierlistRankChecker).toMatchObject({
    channelId: 'updates',
    id: 'tierlist-ranks',
    settingKey: 'rankChanges',
  });
});

test('the first run notifies nothing because there is no snapshot yet', async () => {
  const checker = checkerOver(leaderboard(ranking('أ', 1), ranking('ب', 2)));

  await expect(checker.run()).resolves.toEqual([]);
});

test('the first run stores the snapshot it fetched', async () => {
  const checker = checkerOver(leaderboard(ranking('أ', 1)));

  await checker.run();

  await expect(AsyncStorage.getItem(rankSnapshotKey)).resolves.toContain(
    '"candidateId":"candidate-أ"',
  );
});

test('an unchanged leaderboard notifies nothing', async () => {
  const stable = leaderboard(ranking('أ', 1), ranking('ب', 2));
  const checker = checkerOver(stable, stable);
  await checker.run();

  await expect(checker.run()).resolves.toEqual([]);
});

test('one mover is summarised with its old and new rank', async () => {
  const checker = checkerOver(
    leaderboard(ranking('أ', 1), ranking('ب', 2)),
    leaderboard(ranking('أ', 1), ranking('ب', 3)),
  );
  await checker.run();

  const notification = await notify(checker);
  expect(notification).toMatchObject({
    body: 'وزير ب: من 2 إلى 3',
    data: { feature: 'tierlist' },
    title: 'تغيّرت مراكز تير ليست الحكومة',
  });
});

test('the biggest jump is summarised first', async () => {
  const checker = checkerOver(
    leaderboard(ranking('أ', 1), ranking('ب', 2), ranking('ج', 3)),
    leaderboard(ranking('أ', 3), ranking('ب', 1), ranking('ج', 2)),
  );
  await checker.run();

  const notification = await notify(checker);
  expect(notification.body).toBe(
    'وزير أ: من 1 إلى 3، وزير ب: من 2 إلى 1، وزير ج: من 3 إلى 2',
  );
});

test('more than three movers are cut to three and counted', async () => {
  const before = leaderboard(
    ranking('أ', 1),
    ranking('ب', 2),
    ranking('ج', 3),
    ranking('د', 4),
    ranking('ه', 5),
  );
  const after = leaderboard(
    ranking('أ', 5),
    ranking('ب', 4),
    ranking('ج', 3),
    ranking('د', 1),
    ranking('ه', 2),
  );
  const checker = checkerOver(before, after);
  await checker.run();

  const notification = await notify(checker);
  expect(notification.body).toBe(
    'وزير أ: من 1 إلى 5، وزير د: من 4 إلى 1، وزير ه: من 5 إلى 2، وواحد آخر',
  );
});

test('the movers that did not fit are counted in the plural', async () => {
  const before = leaderboard(
    ranking('أ', 1),
    ranking('ب', 2),
    ranking('ج', 3),
    ranking('د', 4),
    ranking('ه', 5),
  );
  const after = leaderboard(
    ranking('أ', 5),
    ranking('ب', 4),
    ranking('ج', 1),
    ranking('د', 2),
    ranking('ه', 3),
  );
  const checker = checkerOver(before, after);
  await checker.run();

  const notification = await notify(checker);
  expect(notification.body).toBe(
    'وزير أ: من 1 إلى 5، وزير ج: من 3 إلى 1، وزير د: من 4 إلى 2، و2 آخرين',
  );
});

test('a candidate that left the leaderboard is not a move', async () => {
  const checker = checkerOver(
    leaderboard(ranking('أ', 1), ranking('ب', 2)),
    leaderboard(ranking('أ', 1)),
  );
  await checker.run();

  await expect(checker.run()).resolves.toEqual([]);
});

test('a new candidate that pushes nobody around is not a move', async () => {
  const checker = checkerOver(
    leaderboard(ranking('أ', 1)),
    leaderboard(ranking('أ', 1), ranking('ب', 2)),
  );
  await checker.run();

  await expect(checker.run()).resolves.toEqual([]);
});

test('the same change set keeps the same notification id', async () => {
  const before = leaderboard(ranking('أ', 1), ranking('ب', 2));
  const after = leaderboard(ranking('أ', 2), ranking('ب', 1));
  const first = checkerOver(before, after);
  await first.run();
  const firstRun = await notify(first);

  await AsyncStorage.clear();
  const second = checkerOver(before, after);
  await second.run();
  const secondRun = await notify(second);

  expect(secondRun.id).toBe(firstRun.id);
});

test('a different change set gets a different notification id', async () => {
  const before = leaderboard(ranking('أ', 1), ranking('ب', 2), ranking('ج', 3));
  const first = checkerOver(
    before,
    leaderboard(ranking('أ', 2), ranking('ب', 1), ranking('ج', 3)),
  );
  await first.run();
  const firstRun = await notify(first);

  await AsyncStorage.clear();
  const second = checkerOver(
    before,
    leaderboard(ranking('أ', 1), ranking('ب', 3), ranking('ج', 2)),
  );
  await second.run();
  const secondRun = await notify(second);

  expect(secondRun.id).not.toBe(firstRun.id);
});

test('the notification id carries the day the change was seen', async () => {
  const checker = checkerOver(
    leaderboard(ranking('أ', 1), ranking('ب', 2)),
    leaderboard(ranking('أ', 2), ranking('ب', 1)),
  );
  await checker.run();

  const notification = await notify(checker);
  expect(notification.id).toContain('tierlist-ranks:2026-09-04:');
});
