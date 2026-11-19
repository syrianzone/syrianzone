import { expect, test } from 'bun:test';
import { createPopupSession, decodePublicPopup, decodePopupDismissals } from './site-popup-model';

test('public campaign decoding keeps source version and refuses unsafe destinations', () => {
  const source = {
    enabled: true,
    title: 'عنوان',
    description: 'نص',
    buttonText: 'افتح',
    dismissText: 'لاحقاً',
    link: 'https://example.org',
    version: 4
  };
  expect(decodePublicPopup(source).version).toBe(4);
  expect(() => decodePublicPopup({ ...source, link: 'javascript:alert(1)' })).toThrow();
  expect(() => decodePublicPopup({ ...source, version: -1 })).toThrow();
  expect(decodePopupDismissals([1, 1, 4])).toEqual([1, 4]);
});
test('campaign waits two seconds only while eligible and outside interaction quiets the current view', () => {
  let pending: (() => void) | null = null,
    cancellations = 0;
  const shown: boolean[] = [],
    session = createPopupSession(4, false, {
      schedule: (task, delay) => {
        expect(delay).toBe(2000);
        pending = () => {
          pending = null;
          task();
        };
        return () => {
          pending = null;
          cancellations++;
        };
      },
      persist: async () => {},
      show: (visible) => shown.push(visible)
    });
  session.setEligible(true);
  expect(shown).toEqual([]);
  session.setEligible(false);
  expect(cancellations).toBe(1);
  session.setEligible(true);
  (pending as (() => void) | null)?.();
  expect(shown).toEqual([true]);
  session.quiet();
  session.setEligible(true);
  expect(shown).toEqual([true, false]);
  expect(pending).toBeNull();
  session.dispose();
});
test('permanent dismissal persists only its campaign version and reports storage failure without pretending success', async () => {
  const versions: number[] = [],
    shown: boolean[] = [];
  let finish!: () => void;
  const session = createPopupSession(7, false, {
    schedule: (task) => {
      finish = task;
      return () => {};
    },
    persist: async (version) => {
      versions.push(version);
      throw new Error('تعذر الحفظ');
    },
    show: (visible) => shown.push(visible)
  });
  session.setEligible(true);
  finish();
  await expect(session.dismiss()).rejects.toThrow('تعذر الحفظ');
  expect(versions).toEqual([7]);
  expect(shown).toEqual([true]);
  session.dispose();
});
test('a late dismissal does not change the visibility of a replacement campaign', async () => {
  let finish!: () => void, save!: () => void;
  const shown: boolean[] = [],
    persisted: number[] = [];
  const old = createPopupSession(3, false, {
    schedule: (task) => {
      finish = task;
      return () => {};
    },
    persist: (version) =>
      new Promise<void>((resolve) => {
        persisted.push(version);
        save = resolve;
      }),
    show: (visible) => shown.push(visible)
  });
  old.setEligible(true);
  finish();
  const saving = old.dismiss();
  old.dispose();
  save();
  await saving;
  expect(persisted).toEqual([3]);
  expect(shown).toEqual([true]);
  const dismissed = createPopupSession(3, true, {
    schedule: () => {
      throw new Error('dismissed version scheduled');
    },
    persist: async () => {},
    show: () => {}
  });
  dismissed.setEligible(true);
  dismissed.dispose();
});

test('successful dismissal coalesces repeated taps and never reschedules the same version', async () => {
  let fire!: () => void,
    save!: () => void,
    writes = 0,
    timers = 0;
  const shown: boolean[] = [];
  const session = createPopupSession(9, false, {
    schedule: (task) => {
      timers++;
      fire = task;
      return () => {};
    },
    persist: async () => {
      writes++;
      await new Promise<void>((resolve) => {
        save = resolve;
      });
    },
    show: (visible) => shown.push(visible)
  });
  session.setEligible(true);
  fire();
  const first = session.dismiss(),
    second = session.dismiss();
  expect(first).toBe(second);
  expect(writes).toBe(1);
  save();
  await first;
  session.setEligible(false);
  session.setEligible(true);
  expect(timers).toBe(1);
  expect(shown).toEqual([true, false]);
  session.dispose();
});

test('native interaction during the reveal delay quiets the pending campaign for that view', () => {
  let fire!: () => void,
    timers = 0;
  const shown: boolean[] = [];
  const session = createPopupSession(10, false, {
    schedule: (task) => {
      timers++;
      fire = task;
      return () => {};
    },
    persist: async () => {},
    show: (value) => shown.push(value)
  });
  session.setEligible(true);
  session.quiet();
  fire();
  session.setEligible(true);
  expect(shown).toEqual([]);
  expect(timers).toBe(1);
  session.dispose();
});
