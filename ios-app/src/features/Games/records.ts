import { useEffect, useState } from 'react';
import { readDocument, writeDocument } from '../../platform/storage';
import { createGameRecordStore, decodeGameRecords, recordBest, recordFinishedMatch, type GameRecords } from './model';
const KEY = 'syrian-zone.games.records.v1';
const empty = decodeGameRecords(null);
const listeners = new Set<(value: GameRecords) => void>();
const store = createGameRecordStore(() => readDocument(KEY, decodeGameRecords, empty), value => writeDocument(KEY, value));
export function useGameRecords(): { records: GameRecords; error: string | null; best(game: '2048' | 'solitare', value: number): void; match(game: 'tarneeb' | 'trix', result: 'win' | 'loss' | 'draw'): void; large(value: boolean): void } {
  const [records, setRecords] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; listeners.add(setRecords); void store.load().then(value => { if (active) setRecords(value); }).catch(() => { if (active) setError('تعذر قراءة سجل الألعاب.'); }); return () => { active = false; listeners.delete(setRecords); }; }, []);
  const save = (change: (previous: GameRecords) => GameRecords): void => { void store.change(change).then(value => { for (const listener of listeners) listener(value); setError(null); }).catch(() => setError('تعذر حفظ سجل الألعاب. حاول مجدداً.')); };
  return { records, error, best: (game, value) => save(previous => recordBest(previous, game, value)), match: (game, result) => save(previous => recordFinishedMatch(previous, game, result)), large: value => save(previous => ({ ...previous, largeCards: value })) };
}
// PORT STATUS: source resources/js/Pages/Games/_lib/scores.ts and cardDisplay.ts; confidence medium; todos 0.
