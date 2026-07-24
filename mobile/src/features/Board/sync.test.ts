import { pickWinner } from './sync';
import type { BoardDocument } from './types';

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

test('uses document timestamps for deterministic last-write-wins sync', () => {
  expect(pickWinner(local, server)).toEqual({ loser: local, winner: server });
  expect(pickWinner(server, local)).toEqual({ loser: local, winner: server });
});

test('keeps the local document when timestamps are invalid or equal', () => {
  expect(pickWinner(local, { ...server, updatedAt: local.updatedAt })).toEqual({
    loser: null,
    winner: local,
  });
  expect(
    pickWinner(
      { ...local, updatedAt: 'invalid' },
      { ...server, updatedAt: 'also-invalid' },
    ),
  ).toEqual({ loser: null, winner: { ...local, updatedAt: 'invalid' } });
});
