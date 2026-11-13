import { notify } from '@/Lib/notify';

export const COPY_SUCCESS_MESSAGE = 'تم النسخ';
export const COPY_FAILURE_MESSAGE = 'تعذّر النسخ إلى الحافظة';

export interface CopyPorts {
    writeText?: (text: string) => Promise<void>;
    reportCopied?: (message: string) => void;
    reportFailure?: (message: string) => void;
}

export interface CopyOptions extends CopyPorts {
    /** The message this surface already shows on success, when it differs. */
    successMessage?: string;
    /** The message this surface already shows on failure, when it differs. */
    failureMessage?: string;
}

/**
 * Write to the clipboard and report the outcome once. The write is awaited, so
 * success is never announced before the browser accepted it: `navigator.clipboard`
 * is absent in an insecure context and rejects when the permission is denied.
 */
export async function copyText(text: string, options: CopyOptions = {}): Promise<boolean> {
    try {
        await (options.writeText ?? writeClipboard)(text);
    } catch {
        (options.reportFailure ?? notify.error)(options.failureMessage ?? COPY_FAILURE_MESSAGE);
        return false;
    }
    (options.reportCopied ?? notify.copy)(options.successMessage ?? COPY_SUCCESS_MESSAGE);
    return true;
}

function writeClipboard(text: string): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        return Promise.reject(new Error('Clipboard API unavailable'));
    }
    return navigator.clipboard.writeText(text);
}
