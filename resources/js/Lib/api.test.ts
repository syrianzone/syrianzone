import { describe, expect, it } from 'vitest';
import { apiErrorMessage, apiErrorStatus, apiFieldErrors } from './api';

function axiosError(status: number, data: unknown, headers: Record<string, string> = {}) {
  return {
    isAxiosError: true,
    code: 'ERR_BAD_REQUEST',
    response: { status, data, headers },
  };
}

describe('apiErrorMessage', () => {
    it('reads the server message envelope', () => {
        expect(apiErrorMessage(axiosError(400, { message: 'المكان معتمد مسبقاً' }))).toBe('المكان معتمد مسبقاً');
    });

    it('reads the legacy error envelope', () => {
        expect(apiErrorMessage(axiosError(403, { message: 'غير مسموح', error: 'ممنوع' }))).toBe('غير مسموح');
        expect(apiErrorMessage(axiosError(403, { error: 'ممنوع' }))).toBe('ممنوع');
    });

    it('reads a validation errors bag and ignores the generic envelope message', () => {
        const err = axiosError(422, {
            message: 'The given data was invalid.',
            errors: { name: ['الاسم مطلوب'], phone: ['رقم الهاتف غير صالح'] },
        });
        expect(apiErrorMessage(err)).toBe('الاسم مطلوب');
    });

    it('rejects a non-Arabic server message in favour of the fallback', () => {
        expect(apiErrorMessage(axiosError(400, { message: 'Place is already approved' }))).toBe('تعذر تنفيذ الطلب');
        expect(apiErrorMessage(axiosError(400, { message: 'Place is already approved' }), 'تعذّر الحفظ')).toBe('تعذّر الحفظ');
        expect(apiErrorMessage(axiosError(422, { errors: { name: ['The name field is required.'] } }))).toBe('تحقق من البيانات المدخلة');
    });

    it('never lets a caller fallback hide an expired session', () => {
        expect(apiErrorMessage(axiosError(419, { message: 'Page Expired' }), 'تعذّر الحفظ')).toBe('انتهت الجلسة، أعد تحميل الصفحة');
    });

    it('formats a 429 with Retry-After', () => {
        expect(apiErrorMessage(axiosError(429, { message: 'Too Many Attempts.' }, { 'Retry-After': '7' }))).toBe(
            'تم تجاوز حد المحاولات المسموح. يرجى الانتظار 7 ثوانٍ ثم إعادة المحاولة.'
        );
        expect(apiErrorMessage(axiosError(429, {}, { 'Retry-After': '1' }))).toContain('ثانية واحدة');
        expect(apiErrorMessage(axiosError(429, {}, { 'Retry-After': '120' }))).toContain('120 ثانية');
    });

    it('falls back to a generic message for a 429 without Retry-After', () => {
        expect(apiErrorMessage(axiosError(429, { message: 'Too Many Attempts.' }))).toBe('محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة');
    });

    it('reports a network failure', () => {
        expect(apiErrorMessage({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error', request: {} })).toBe(
            'تعذر الاتصال بالخادم، تحقق من اتصالك بالإنترنت وحاول مجدداً'
        );
    });

    it('reports a timeout', () => {
        expect(apiErrorMessage({ isAxiosError: true, code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' })).toBe(
            'انتهت مهلة الطلب، حاول مجدداً'
        );
    });

    it('uses the HTTP status when nothing else is available', () => {
        expect(apiErrorMessage(axiosError(404, {}))).toBe('العنصر غير موجود');
        expect(apiErrorMessage(axiosError(419, {}))).toBe('انتهت الجلسة، أعد تحميل الصفحة');
    });

    it('returns the fallback for an unknown error', () => {
        expect(apiErrorMessage({}, 'خطأ')).toBe('خطأ');
        expect(apiErrorMessage(null)).toBe('حدث خطأ غير متوقع');
    });

    it('exposes the status of a failed response', () => {
        expect(apiErrorStatus(axiosError(422, {}))).toBe(422);
        expect(apiErrorStatus(new Error('boom'))).toBeUndefined();
    });
});

describe('apiFieldErrors', () => {
    it('keeps the first message per field and collapses indexed fields', () => {
        const err = axiosError(422, {
            errors: {
                name: ['الاسم مطلوب', 'الاسم قصير جداً'],
                city: ['المدينة مطلوبة'],
                'photos.0': ['الصورة كبيرة جداً'],
            },
        });
        expect(apiFieldErrors(err)).toEqual({
            name: 'الاسم مطلوب',
            city: 'المدينة مطلوبة',
            photos: 'الصورة كبيرة جداً',
        });
    });

    it('drops non-Arabic messages when asked', () => {
        const err = axiosError(422, { errors: { name: ['The name field is required.'], city: ['المدينة مطلوبة'] } });
        expect(apiFieldErrors(err, { arabicOnly: true })).toEqual({ city: 'المدينة مطلوبة' });
    });

    it('returns an empty map when the response has no errors bag', () => {
        expect(apiFieldErrors(axiosError(500, { message: 'خطأ' }))).toEqual({});
        expect(apiFieldErrors(null)).toEqual({});
    });
});
