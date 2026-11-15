import { decodeAlignment, defaultAlignment, type Alignment } from '../../src/features/Alignment/model';
import { alignmentRun } from './alignment-launch-model';

export const alignmentDocumentKey = 'syrian-zone.document.alignment.v1';
export const alignmentOwnerKey = 'syrian-zone.native-fixture.alignment-owner.v1';
export interface AlignmentPair { document: string | null; owner: string | null }
export interface AlignmentFixtureStore {
  read(): Promise<AlignmentPair>;
  owner(before: AlignmentPair, next: string): Promise<void>;
  close(before: AlignmentPair): Promise<void>;
}
interface Owner { version: 1; run: string; initial: 'absent'; phase: 'armed' | 'checkpoint' | 'empty-saved'; pointID: number | null }
const refused = (): never => { throw new Error('The exact owned Alignment document was refused and retained.'); };
const keys = (value: object, expected: string[]): boolean => Object.keys(value).sort().join(',') === expected.sort().join(',');
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : refused();
export const alignmentPointName = (run: string): string => `Alignment QA ${run}`;

function decodeOwner(raw: string | null, run: string): Owner {
  if (!raw || raw.length > 512) return refused();
  const value = object(JSON.parse(raw));
  if (!keys(value, ['version', 'run', 'initial', 'phase', 'pointID']) || value.version !== 1 || value.run !== run || value.initial !== 'absent'
    || !['armed', 'checkpoint', 'empty-saved'].includes(String(value.phase))
    || (value.phase === 'armed' ? value.pointID !== null : !Number.isSafeInteger(value.pointID) || Number(value.pointID) < 1)) return refused();
  return value as unknown as Owner;
}

function drawing(raw: string | null): Alignment {
  if (raw === null || raw.length > 4096) return refused();
  const value = object(JSON.parse(raw)), axes = object(value.axes), colors = object(value.colors);
  if (!keys(value, ['version', 'axes', 'colors', 'dots']) || !keys(axes, ['left', 'right', 'top', 'bottom'])
    || !keys(colors, ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']) || !Array.isArray(value.dots) || value.dots.length > 1
    || value.dots.some(item => !keys(object(item), ['id', 'x', 'y', 'color', 'name']))) return refused();
  const state = decodeAlignment(value), defaults = defaultAlignment();
  if (JSON.stringify(state.axes) !== JSON.stringify(defaults.axes)
    || Object.keys(defaults.colors).some(key => state.colors[key as keyof Alignment['colors']].toLowerCase() !== defaults.colors[key as keyof Alignment['colors']].toLowerCase())) return refused();
  return state;
}

function ownedPoint(state: Alignment, owner: Owner): void {
  const dot = state.dots[0];
  if (state.dots.length !== 1 || !dot || dot.name !== alignmentPointName(owner.run) || dot.color.toLowerCase() !== '#f44336'
    || dot.x !== 0.375 || dot.y !== 0.625 || owner.pointID !== null && owner.pointID !== dot.id) refused();
}

export function createAlignmentFixture(store: AlignmentFixtureStore) {
  return {
    async prepare(run: string, stage: 'fresh' | 'resume') {
      if (!alignmentRun(run)) return refused();
      const before = await store.read();
      if (stage === 'fresh') {
        // Unknown document bytes are neither parsed nor rewritten on refusal.
        if (before.document !== null || before.owner !== null) return refused();
        const owner: Owner = { version: 1, run, initial: 'absent', phase: 'armed', pointID: null };
        await store.owner(before, JSON.stringify(owner));
        return { run, phase: 'armed', initiallyAbsent: true } as const;
      }
      const owner = decodeOwner(before.owner, run), state = drawing(before.document);
      if (owner.phase !== 'checkpoint') return refused();
      ownedPoint(state, owner);
      return { run, phase: 'checkpoint', initiallyAbsent: true, point: state.dots[0] } as const;
    },
    async observe(run: string) {
      if (!alignmentRun(run)) return refused();
      const before = await store.read(), owner = decodeOwner(before.owner, run), state = drawing(before.document);
      const dot = state.dots[0];
      if (dot && (dot.color.toLowerCase() !== '#f44336' || !['نقطة 1', alignmentPointName(run)].includes(dot.name)
        || owner.pointID !== null && owner.pointID !== dot.id)) return refused();
      return { run, phase: owner.phase, defaultAxes: true, defaultPalette: true, dots: state.dots } as const;
    },
    async checkpoint(run: string) {
      if (!alignmentRun(run)) return refused();
      const before = await store.read(), owner = decodeOwner(before.owner, run), state = drawing(before.document);
      if (!['armed', 'checkpoint'].includes(owner.phase)) return refused();
      ownedPoint(state, owner);
      const dot = state.dots[0]!;
      await store.owner(before, JSON.stringify({ ...owner, phase: 'checkpoint', pointID: dot.id }));
      return { run, phase: 'checkpoint', defaultAxes: true, defaultPalette: true, dots: state.dots } as const;
    },
    async acknowledgeEmptySaved(run: string) {
      if (!alignmentRun(run)) return refused();
      const before = await store.read(), owner = decodeOwner(before.owner, run), state = drawing(before.document);
      if (owner.phase !== 'checkpoint' || state.dots.length !== 0) return refused();
      await store.owner(before, JSON.stringify({ ...owner, phase: 'empty-saved' }));
      return { run, phase: 'empty-saved', defaultAxes: true, defaultPalette: true, dots: [] } as const;
    },
    async close(run: string) {
      if (!alignmentRun(run)) return refused();
      const before = await store.read(), owner = decodeOwner(before.owner, run), state = drawing(before.document);
      if (owner.phase !== 'empty-saved' || state.dots.length !== 0) return refused();
      // Cold fixture entry has not imported App, so its autosave writer is absent.
      // The store removes only the exact compared document and proof atomically.
      await store.close(before);
      return { run, phase: 'closed', initiallyAbsent: true, documentAbsent: true, ownerAbsent: true } as const;
    },
  };
}
