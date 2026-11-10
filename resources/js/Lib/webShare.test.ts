import { afterEach, describe, expect, it, vi } from 'vitest';
import { canNativeShare, isShareCancelled } from './webShare';

afterEach(() => vi.unstubAllGlobals());

describe('native share support', () => {
    it('is unavailable on the server and in unsupported browsers', () => {
        vi.stubGlobal('navigator', undefined);
        expect(canNativeShare({ url: '/promises/8' })).toBe(false);
        vi.stubGlobal('navigator', {});
        expect(canNativeShare({ url: '/promises/8' })).toBe(false);
    });

    it('allows older link-only implementations without offering file sharing', () => {
        vi.stubGlobal('navigator', { share: vi.fn() });
        expect(canNativeShare({ url: '/promises/8' })).toBe(true);
        expect(canNativeShare({ files: [new File([], 'promise-8.png', { type: 'image/png' })] })).toBe(false);
    });

    it('respects data-specific support and blocked policies', () => {
        const canShare = vi.fn((data: ShareData) => !data.files);
        vi.stubGlobal('navigator', { share: vi.fn(), canShare });
        expect(canNativeShare({ url: '/promises/8' })).toBe(true);
        expect(canNativeShare({ files: [new File([], 'promise-8.png')] })).toBe(false);
        canShare.mockReturnValue(false);
        expect(canNativeShare({ url: '/promises/8' })).toBe(false);
    });

    it('treats failed capability checks as unsupported', () => {
        vi.stubGlobal('navigator', { share: vi.fn(), canShare: () => { throw new Error('blocked'); } });
        expect(canNativeShare({ url: '/promises/8' })).toBe(false);
    });
});

it('distinguishes cancellation from actual share errors', () => {
    expect(isShareCancelled(new DOMException('Cancelled', 'AbortError'))).toBe(true);
    expect(isShareCancelled(new DOMException('Blocked', 'NotAllowedError'))).toBe(false);
    expect(isShareCancelled(null)).toBe(false);
    expect(isShareCancelled('AbortError')).toBe(false);
});
