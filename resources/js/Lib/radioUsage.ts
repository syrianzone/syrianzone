// Quran listening data-usage accounting.
//
// Playback streams the v4 on-demand files; a media element's transfer size is
// unreadable from script, so usage is estimated from a nominal bitrate over the
// listening time. It is an estimate, not a wire measurement.
//
// Three counters, deliberately separate:
//
//   session   since this page loaded, in memory
//   device    this browser, ever
//   account   this user, across devices, on the server
//
// The device counter is what a guest sees. For a signed-in user the account
// counter is the interesting one, and it is fed by pushing *deltas* rather than
// totals, so two devices listening at once both count and neither overwrites
// the other.
//
// The device and pending counters live in memory and are only written to
// localStorage on a slower cadence: the readout ticks every second, and a
// synchronous write per tick would be wasteful for no benefit.

/** Nominal bitrate used for the estimate. */
export const STREAM_BITRATE_BPS = 128_000;

/** What one hour of listening costs: 128 kbps * 3600 s / 8. */
export const BYTES_PER_HOUR = (STREAM_BITRATE_BPS * 3600) / 8;

export interface UsageTotals {
  bytes: number;
  seconds: number;
}

const DEVICE_KEY = 'sz-muslim-radio-usage';
const PENDING_KEY = 'sz-muslim-radio-pending';

export const EMPTY_TOTALS: UsageTotals = { bytes: 0, seconds: 0 };

export function bytesForSeconds(seconds: number): number {
  return Math.max(0, seconds) * (STREAM_BITRATE_BPS / 8);
}

/** Arabic-formatted size: كيلوبايت / ميغابايت / غيغابايت. */
export function formatBytes(bytes: number): string {
  const b = Math.max(0, Math.round(bytes));
  if (b < 1024) return `${b} بايت`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} كيلوبايت`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} ميغابايت`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} غيغابايت`;
}

function readStored(key: string): UsageTotals {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { ...EMPTY_TOTALS };
    const parsed = JSON.parse(raw) as Partial<UsageTotals>;
    return {
      bytes: Number.isFinite(parsed.bytes) ? Math.max(0, Number(parsed.bytes)) : 0,
      seconds: Number.isFinite(parsed.seconds) ? Math.max(0, Number(parsed.seconds)) : 0,
    };
  } catch {
    return { ...EMPTY_TOTALS };
  }
}

function writeStored(key: string, totals: UsageTotals): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({
      bytes: Math.round(totals.bytes),
      seconds: totals.seconds,
    }));
  } catch {
    /* private mode: usage simply is not remembered */
  }
}

let device: UsageTotals = { ...EMPTY_TOTALS };
let pending: UsageTotals = { ...EMPTY_TOTALS };
let session: UsageTotals = { ...EMPTY_TOTALS };

/** Re-read both persisted counters, e.g. on mount. */
export function loadUsage(): void {
  device = readStored(DEVICE_KEY);
  pending = readStored(PENDING_KEY);
}

export function getDeviceTotals(): UsageTotals {
  return { ...device };
}

export function getPendingDelta(): UsageTotals {
  return { ...pending };
}

export function getSessionTotals(): UsageTotals {
  return { ...session };
}

/** Memory only — call persistUsage() to make it survive a reload. */
export function addDeviceUsage(delta: UsageTotals): void {
  device = { bytes: device.bytes + delta.bytes, seconds: device.seconds + delta.seconds };
}

export function addSessionUsage(delta: UsageTotals): void {
  session = { bytes: session.bytes + delta.bytes, seconds: session.seconds + delta.seconds };
}

/** Rounded, because the endpoint validates integers. */
export function addPendingUsage(delta: UsageTotals): void {
  pending = {
    bytes: pending.bytes + Math.round(delta.bytes),
    seconds: pending.seconds + Math.round(delta.seconds),
  };
}

export function clearPendingUsage(): void {
  pending = { ...EMPTY_TOTALS };
}

/** Write the counters to localStorage. Cheap enough for every few seconds. */
export function persistUsage(): void {
  writeStored(DEVICE_KEY, device);
  writeStored(PENDING_KEY, pending);
}

/** Zero everything held in memory and on disk. */
export function clearUsage(): void {
  device = { ...EMPTY_TOTALS };
  pending = { ...EMPTY_TOTALS };
  session = { ...EMPTY_TOTALS };
  persistUsage();
}
