// Shared formatting for the Muslim corner. `formatDuration` was duplicated
// verbatim in Index.tsx and PrayerTab.tsx; the radio applet needs it too.

/** `h:mm:ss`, clamped at zero. Used for countdowns and elapsed live time. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
