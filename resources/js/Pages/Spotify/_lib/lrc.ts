export interface LrcLine {
  time: number | null;
  text: string;
}

// tolerates [m:ss], [mm:ss.xx], [mm:ss.xxx] and repeated timestamps on one line;
// seconds are capped at 59 so a malformed [00:70] is junk, not 130 seconds
const TIME_TAG = /^\[(\d{1,3}):([0-5]\d)(?:[.:](\d{1,3}))?\]/;
// metadata tags like [ar:..], [ti:..], [offset:..] are not lyrics
const META_TAG = /^\[[a-zA-Z#][^\]]*\]$/;

export function parseLrc(lrc: string): LrcLine[] {
  const out: LrcLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    let rest = raw.trim();
    if (!rest) continue;
    const times: number[] = [];
    let m = TIME_TAG.exec(rest);
    while (m) {
      const frac = m[3] ? parseInt(m[3], 10) / 10 ** m[3].length : 0;
      times.push(parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + frac);
      rest = rest.slice(m[0].length).trimStart();
      m = TIME_TAG.exec(rest);
    }
    if (times.length === 0) {
      if (META_TAG.test(rest)) continue;
      // malformed bracket junk ([00:70], [1:5]) is stripped, not shown as lyrics
      rest = rest.replace(/^(?:\[[^\]]*\]\s*)+/, '').trim();
      if (rest) out.push({ time: null, text: rest });
      continue;
    }
    if (!rest) continue;
    for (const time of times) out.push({ time, text: rest });
  }
  // file order is preserved (unsynced lines stay in place); activeLineIndex
  // copes with out-of-order stamps, so no sort
  return out;
}

export function activeLineIndex(lines: LrcLine[], currentTime: number): number {
  // highest timestamp <= t wins, later index on ties: robust to unordered stamps
  let active = -1;
  let best = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].time;
    if (t !== null && t <= currentTime && t >= best) {
      best = t;
      active = i;
    }
  }
  return active;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
