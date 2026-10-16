import { describe, expect, it } from 'vitest';
import { extractApiErrorMessage, extractApiFieldErrors } from './apiError';

describe('apiError helpers', () => {
    it('extracts message from standard Laravel response', () => {
        const err = {
            response: {
                status: 400,
                data: { message: 'Place is already approved' },
            },
        };
        expect(extractApiErrorMessage(err)).toBe('Place is already approved');
    });

    it('falls back to first field error when message is generic or missing', () => {
        const err = {
            response: {
                status: 422,
                data: {
                    errors: {
                        name: ['الاسم مطلوب'],
                        phone: ['رقم الهاتف غير صالح'],
                    },
                },
            },
        };
        expect(extractApiErrorMessage(err)).toBe('الاسم مطلوب');
    });

    it('supports legacy error string key', () => {
        const err = {
            response: {
                status: 403,
                data: { error: 'Forbidden token' },
            },
        };
        expect(extractApiErrorMessage(err)).toBe('Forbidden token');
    });

    it('returns fallback when no error message is present', () => {
        expect(extractApiErrorMessage({}, 'Custom fallback')).toBe('Custom fallback');
    });

    it('extracts first error per field from 422 errors bag', () => {
        const err = {
            response: {
                status: 422,
                data: {
                    message: 'الاسم مطلوب (and 1 more error)',
                    errors: {
                        name: ['الاسم مطلوب', 'الاسم قصير جداً'],
                        city: ['المدينة مطلوبة'],
                    },
                },
            },
        };
        expect(extractApiFieldErrors(err)).toEqual({
            name: 'الاسم مطلوب',
            city: 'المدينة مطلوبة',
        });
    });
});
