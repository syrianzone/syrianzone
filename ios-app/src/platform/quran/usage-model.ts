import { finiteNumber, record } from '../validation';
export interface UsageLedger { seconds: number; pending: Record<string, number> }
export interface UsageTotals { seconds: number; bytes: number }
export const bytesForSeconds = (seconds: number): number => Math.max(0, seconds) * 16000;
export const emptyUsage = (): UsageLedger => ({ seconds: 0, pending: {} });
export function decodeUsage(value: unknown): UsageLedger {
  const row = record(value), seconds = finiteNumber(row.seconds), pending: Record<string, number> = {};
  if (seconds < 0) throw new Error('سجل الاستماع غير صالح.');
  for (const [key, raw] of Object.entries(record(row.pending))) {
    if (!/^[1-9]\d*$/.test(key)) throw new Error('مالك سجل الاستماع غير صالح.');
    const count = finiteNumber(raw); if (count < 0) throw new Error('مدة الاستماع غير صالحة.'); pending[key] = count;
  }
  return { seconds, pending };
}
export function addListening(ledger: UsageLedger, seconds: number, owner: number | null): UsageLedger {
  if (!Number.isFinite(seconds) || seconds <= 0) return ledger;
  return { seconds: ledger.seconds + seconds, pending: owner === null ? ledger.pending : { ...ledger.pending, [owner]: (ledger.pending[String(owner)] ?? 0) + seconds } };
}
export function pendingBatch(ledger: UsageLedger, owner: number): UsageTotals | null {
  const seconds = Math.min(86400, Math.floor(ledger.pending[String(owner)] ?? 0));
  return seconds > 0 ? { seconds, bytes: bytesForSeconds(seconds) } : null;
}
export function acknowledge(ledger: UsageLedger, owner: number, seconds: number): UsageLedger {
  return { ...ledger, pending: { ...ledger.pending, [owner]: Math.max(0, (ledger.pending[String(owner)] ?? 0) - seconds) } };
}
export function formatBytes(value: number): string {
  const bytes = Math.max(0, Math.round(value));
  return bytes < 1024 ? `${bytes} بايت` : bytes < 1048576 ? `${(bytes / 1024).toFixed(0)} كيلوبايت` : bytes < 1073741824 ? `${(bytes / 1048576).toFixed(1)} ميغابايت` : `${(bytes / 1073741824).toFixed(2)} غيغابايت`;
}
