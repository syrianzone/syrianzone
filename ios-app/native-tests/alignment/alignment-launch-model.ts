export type AlignmentFixtureLaunch = {
  kind: 'session'; user: 'member'; gate: string; variant: 'alignment'; run: string; stage: 'fresh' | 'resume' | 'close';
};
const refused = (): never => { throw new Error('Local Alignment fixture launch rejected.'); };
export const alignmentRun = (value: string): boolean => /^[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/.test(value);

export function parseAlignmentFixtureLaunch(origin: string, input: string): AlignmentFixtureLaunch | null {
  let url: URL;
  try { url = new URL(input); } catch { return null; }
  if (url.searchParams.get('variant') !== 'alignment') return null;
  if (origin !== 'https://127.0.0.1:9443' || url.protocol !== 'syrianzone:' || url.hostname !== 'fixture'
    || url.port || url.username || url.password || input.split(/[?#]/, 1)[0] !== 'syrianzone://fixture/session') return refused();
  const keys = [...url.searchParams.keys()], run = url.searchParams.get('run'), stage = url.searchParams.get('stage');
  let gate: string;
  try { gate = decodeURIComponent(url.hash.slice(1)); } catch { return refused(); }
  if (keys.length !== 4 || new Set(keys).size !== 4 || keys.some(key => !['user', 'variant', 'run', 'stage'].includes(key))
    || url.searchParams.get('user') !== 'member' || !run || !alignmentRun(run)
    || !['fresh', 'resume', 'close'].includes(stage ?? '') || !/^[A-Za-z0-9_-]{16,256}$/.test(gate)) return refused();
  return { kind: 'session', user: 'member', gate, variant: 'alignment', run, stage: stage as AlignmentFixtureLaunch['stage'] };
}
