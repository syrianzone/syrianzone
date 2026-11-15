import { expect, test } from 'bun:test';
import { decodeBroadcast, decodeLobby, decodeRoom, decodeSnapshot, updateFromBroadcast } from './model';
test('decodes room portraits and guest lobby without leaking model/session fields', () => {
  expect(decodeLobby({ categories: [{ id: 1, name_ar: 'شخصيات', name_en: 'People', characters_count: 12 }], total_characters: 24 }).categories[0]?.id).toBe(1);
  const room = decodeRoom({ game: { room_code: 'room', category: { name_ar: 'عشوائي', characters: [{ id: 5, name_ar: 'شخصية', image_path: 'guesswho/characters/five.webp' }] } } });
  expect(room.characters[0]?.image).toBe('https://syrian.zone/storage/guesswho/characters/five.webp');
  expect(() => decodeRoom({ game: { room_code: 'room', category: { name_ar: 'x', characters: [{ id: 1, name_ar: 'x', image_path: '../secret' }] } } })).toThrow();
});
test('realtime public updates preserve private secret and elimination snapshot', () => {
  const own = decodeSnapshot({ status: 'playing', turn: 'p1', winner: null, myCharacterId: 5, myEliminated: [7], opponentRemaining: 22 });
  const event = decodeBroadcast({ status: 'playing', turn: 'p2', winner: null, remaining: { p1: 23, p2: 20 }, guess: { by: 'p1', characterId: 8, correct: false } });
  const next = updateFromBroadcast(own, event, 'p1');
  expect(next.myCharacterId).toBe(5); expect(next.myEliminated).toEqual([7]); expect(next.opponentRemaining).toBe(20); expect(next.turn).toBe('p2');
  expect(() => decodeBroadcast({ ...event, remaining: { p1: [1, 2] } })).toThrow();
});
