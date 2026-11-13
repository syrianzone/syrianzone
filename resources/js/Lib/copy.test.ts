import { afterEach, describe, expect, it, vi } from 'vitest';
import { COPY_FAILURE_MESSAGE, COPY_SUCCESS_MESSAGE, copyText } from './copy';

afterEach(() => vi.unstubAllGlobals());

function ports() {
    return {
        writeText: vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined),
        reportCopied: vi.fn(),
        reportFailure: vi.fn(),
    };
}

describe('copyText', () => {
    it('awaits the clipboard write and reports success once', async () => {
        const { writeText, reportCopied, reportFailure } = ports();

        await expect(copyText('0912345678', { writeText, reportCopied, reportFailure })).resolves.toBe(true);

        expect(writeText).toHaveBeenCalledExactlyOnceWith('0912345678');
        expect(reportCopied).toHaveBeenCalledExactlyOnceWith(COPY_SUCCESS_MESSAGE);
        expect(reportFailure).not.toHaveBeenCalled();
    });

    it('keeps the message a surface already shows', async () => {
        const { writeText, reportCopied, reportFailure } = ports();

        await copyText('https://syrian.zone/promises/8', {
            writeText,
            reportCopied,
            reportFailure,
            successMessage: 'نُسخ الرابط',
        });

        expect(reportCopied).toHaveBeenCalledExactlyOnceWith('نُسخ الرابط');
    });

    it('reports a rejected write as a failure, never as success', async () => {
        const { writeText, reportCopied, reportFailure } = ports();
        writeText.mockRejectedValue(new DOMException('Write permission denied', 'NotAllowedError'));

        await expect(copyText('0912345678', { writeText, reportCopied, reportFailure })).resolves.toBe(false);

        expect(reportCopied).not.toHaveBeenCalled();
        expect(reportFailure).toHaveBeenCalledExactlyOnceWith(COPY_FAILURE_MESSAGE);
    });

    it('fails without the clipboard API instead of claiming success', async () => {
        const { reportCopied, reportFailure } = ports();
        vi.stubGlobal('navigator', {});

        await expect(copyText('0912345678', { reportCopied, reportFailure })).resolves.toBe(false);

        expect(reportCopied).not.toHaveBeenCalled();
        expect(reportFailure).toHaveBeenCalledExactlyOnceWith(COPY_FAILURE_MESSAGE);
    });

    it('uses the browser clipboard when no writer is injected', async () => {
        const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        const { reportCopied, reportFailure } = ports();

        await expect(copyText('نص', { reportCopied, reportFailure })).resolves.toBe(true);

        expect(writeText).toHaveBeenCalledExactlyOnceWith('نص');
        expect(reportCopied).toHaveBeenCalledOnce();
    });
});
