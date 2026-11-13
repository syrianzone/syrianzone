import { afterEach, describe, expect, it, vi } from 'vitest';
import { canNativeShare, isShareCancelled, shareOrCopy } from './webShare';
import { COPY_SUCCESS_MESSAGE } from './copy';

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

describe('shareOrCopy', () => {
    const ports = () => ({
        writeText: vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined),
        reportCopied: vi.fn(),
        reportFailure: vi.fn(),
    });

    it('uses the native share sheet and does not touch the clipboard', async () => {
        const share = vi.fn<(data: ShareData) => Promise<void>>().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { share });
        const { writeText, reportCopied, reportFailure } = ports();
        const target = { title: 'وعد', text: 'نص', url: 'https://syrian.zone/promises/8' };

        await expect(shareOrCopy(target, { writeText, reportCopied, reportFailure })).resolves.toBe('shared');

        expect(share).toHaveBeenCalledExactlyOnceWith(target);
        expect(writeText).not.toHaveBeenCalled();
        expect(reportCopied).not.toHaveBeenCalled();
        expect(reportFailure).not.toHaveBeenCalled();
    });

    it('treats a cancelled share sheet as a silent cancel', async () => {
        const share = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
        vi.stubGlobal('navigator', { share });
        const { writeText, reportCopied, reportFailure } = ports();

        await expect(shareOrCopy({ url: '/promises/8' }, { writeText, reportCopied, reportFailure }))
            .resolves.toBe('cancelled');

        expect(writeText).not.toHaveBeenCalled();
        expect(reportCopied).not.toHaveBeenCalled();
        expect(reportFailure).not.toHaveBeenCalled();
    });

    it('copies the link when the browser has no share sheet', async () => {
        vi.stubGlobal('navigator', {});
        const { writeText, reportCopied, reportFailure } = ports();

        await expect(shareOrCopy(
            { title: 'وعد', url: 'https://syrian.zone/promises/8' },
            { writeText, reportCopied, reportFailure, successMessage: 'نُسخ الرابط' },
        )).resolves.toBe('copied');

        expect(writeText).toHaveBeenCalledExactlyOnceWith('https://syrian.zone/promises/8');
        expect(reportCopied).toHaveBeenCalledExactlyOnceWith('نُسخ الرابط');
    });

    it('reports failure when neither sharing nor copying is possible', async () => {
        vi.stubGlobal('navigator', {});
        const { writeText, reportCopied, reportFailure } = ports();
        writeText.mockRejectedValue(new Error('blocked'));

        await expect(shareOrCopy({ url: '/promises/8' }, { writeText, reportCopied, reportFailure }))
            .resolves.toBe('failed');

        expect(reportCopied).not.toHaveBeenCalled();
        expect(reportFailure).toHaveBeenCalledOnce();
    });

    it('falls back to the clipboard when the share sheet rejects for another reason', async () => {
        const share = vi.fn().mockRejectedValue(new DOMException('Blocked', 'NotAllowedError'));
        vi.stubGlobal('navigator', { share });
        const { writeText, reportCopied } = ports();

        await expect(shareOrCopy({ url: '/promises/8' }, { writeText, reportCopied })).resolves.toBe('copied');

        expect(writeText).toHaveBeenCalledExactlyOnceWith('/promises/8');
        expect(reportCopied).toHaveBeenCalledExactlyOnceWith(COPY_SUCCESS_MESSAGE);
    });
});
