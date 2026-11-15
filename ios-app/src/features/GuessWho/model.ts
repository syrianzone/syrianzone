import { array, assetUrl, integer, record, text } from '../../platform/validation';
export type Status = 'lobby' | 'selecting' | 'playing' | 'finished';
export interface Category { id: number; nameAr: string; nameEn: string; count: number }
export interface Lobby { categories: Category[]; total: number }
export interface Character { id: number; name: string; image: string }
export interface Room { code: string; category: string; characters: Character[] }
export interface Snapshot { status: Status; turn: string | null; winner: string | null; myCharacterId: number | null; myEliminated: number[]; opponentRemaining: number | null }
export interface Broadcast { status: Status; turn: string | null; winner: string | null; remaining: Record<string, number | null>; guess: { by: string; characterId: number; correct: boolean } | null }
const nullableText = (value: unknown): string | null => value == null ? null : text(value);
const nonnegative = (value: unknown): number => { const n = integer(value); if (n < 0) throw new Error('عدد غير صالح.'); return n; };
const positive = (value: unknown): number => { const n = nonnegative(value); if (n === 0) throw new Error('شخصية غير صالحة.'); return n; };
function status(value: unknown): Status { if (!['lobby', 'selecting', 'playing', 'finished'].includes(String(value))) throw new Error('حالة الغرفة غير صالحة.'); return value as Status; }
export function decodeLobby(value: unknown): Lobby {
  const page = record(value);
  return { total: nonnegative(page.total_characters), categories: array(page.categories).map(item => { const c = record(item); return { id: positive(c.id), nameAr: text(c.name_ar), nameEn: text(c.name_en, ''), count: nonnegative(c.characters_count) }; }) };
}
export function decodeRoom(value: unknown): Room {
  const game = record(record(value).game); const category = record(game.category);
  return { code: text(game.room_code), category: text(category.name_ar), characters: array(category.characters).map(item => {
    const c = record(item); const path = text(c.image_path);
    if (path.startsWith('/') || path.includes('\\') || path.split('/').some(part => part === '..' || part === '.')) throw new Error('صورة شخصية غير صالحة.');
    const image = assetUrl(`/storage/${path}`); if (!image) throw new Error('صورة شخصية غير صالحة.');
    return { id: positive(c.id), name: text(c.name_ar), image };
  }) };
}
export function decodeSnapshot(value: unknown): Snapshot {
  const s = record(value);
  return { status: status(s.status), turn: nullableText(s.turn), winner: nullableText(s.winner), myCharacterId: s.myCharacterId == null ? null : positive(s.myCharacterId), myEliminated: array(s.myEliminated ?? []).map(positive), opponentRemaining: s.opponentRemaining == null ? null : nonnegative(s.opponentRemaining) };
}
export function decodeBroadcast(value: unknown): Broadcast {
  const event = record(value); const remaining = Object.fromEntries(Object.entries(record(event.remaining)).map(([id, count]) => [id, count == null ? null : nonnegative(count)]));
  const guess = event.guess == null ? null : record(event.guess);
  if (guess && typeof guess.correct !== 'boolean') throw new Error('نتيجة تخمين غير صالحة.');
  return { status: status(event.status), turn: nullableText(event.turn), winner: nullableText(event.winner), remaining,
    guess: guess ? { by: text(guess.by), characterId: positive(guess.characterId), correct: guess.correct as boolean } : null };
}
export function updateFromBroadcast(snapshot: Snapshot, event: Broadcast, identity: string): Snapshot {
  const opponent = Object.keys(event.remaining).find(id => id !== identity);
  return { ...snapshot, status: event.status, turn: event.turn, winner: event.winner, opponentRemaining: opponent ? event.remaining[opponent] ?? null : snapshot.opponentRemaining };
}
export function decodeAction(value: unknown): Pick<Snapshot, 'status' | 'turn' | 'winner'> {
  const result = record(value); if (result.status !== 'ok') throw new Error('لم تؤكد الغرفة الحركة.');
  const state = record(result.state);
  return { status: status(state.status), turn: nullableText(state.turn), winner: nullableText(state.winner) };
}
export function decodeAuthorization(value: unknown): { auth: string; channel_data: string } { const data = record(value); return { auth: text(data.auth), channel_data: text(data.channel_data) }; }
// PORT STATUS: source resources/js/Pages/GuessWho/Room.tsx and app/Http/Controllers/GuessWhoController.php; confidence high; todos 0.
