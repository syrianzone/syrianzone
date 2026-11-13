import { beforeEach, describe, expect, it, vi } from 'vitest';

// The module keeps the host registration and the queue in module scope, so each
// test imports a fresh copy.
async function freshConfirm() {
    vi.resetModules();
    return import('./confirm');
}

describe('confirmDialog', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('holds a request until the host registers, and never answers it itself', async () => {
        const { confirmDialog, registerConfirmOpener } = await freshConfirm();

        let settled = false;
        const answer = confirmDialog({ title: 'حذف المكان نهائياً؟' }).then((value) => {
            settled = true;
            return value;
        });

        // Nothing may answer on the caller's behalf while no host is mounted.
        await Promise.resolve();
        expect(settled).toBe(false);

        const shown: string[] = [];
        registerConfirmOpener((options, resolve) => {
            shown.push(options.title);
            resolve(true);
        });

        await expect(answer).resolves.toBe(true);
        expect(shown).toEqual(['حذف المكان نهائياً؟']);
    });

    it('shows one dialog at a time and answers in order', async () => {
        const { confirmDialog, registerConfirmOpener } = await freshConfirm();

        const shown: string[] = [];
        const resolvers: Array<(confirmed: boolean) => void> = [];
        registerConfirmOpener((options, resolve) => {
            shown.push(options.title);
            resolvers.push(resolve);
        });

        const first = confirmDialog({ title: 'الأول' });
        const second = confirmDialog({ title: 'الثاني' });
        expect(shown).toEqual(['الأول']);

        resolvers[0]?.(false);
        await expect(first).resolves.toBe(false);
        expect(shown).toEqual(['الأول', 'الثاني']);

        resolvers[1]?.(true);
        await expect(second).resolves.toBe(true);
    });
});
