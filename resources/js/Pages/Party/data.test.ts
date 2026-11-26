import { describe, expect, it } from 'vitest';
import { formatSocialUrl, safeHttpUrl } from './data';

describe('party link safety', () => {
    it('keeps http(s) URLs', () => {
        expect(safeHttpUrl('https://example.org/about')).toBe('https://example.org/about');
        expect(safeHttpUrl(' http://example.org ')).toBe('http://example.org/');
        expect(safeHttpUrl('www.party.org/about')).toBe('https://www.party.org/about');
    });

    it('drops script, data and relative URLs', () => {
        expect(safeHttpUrl('javascript:alert(1)')).toBe('');
        expect(safeHttpUrl('JaVaScRiPt:alert(1)')).toBe('');
        expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe('');
        expect(safeHttpUrl('/relative')).toBe('');
        expect(safeHttpUrl('')).toBe('');
        expect(safeHttpUrl(null)).toBe('');
    });

    it('builds platform URLs from handles and validates full URLs', () => {
        expect(formatSocialUrl('x', '@party')).toBe('https://x.com/party');
        expect(formatSocialUrl('telegram', 'channel')).toBe('https://t.me/channel');
        expect(formatSocialUrl('facebook', 'https://facebook.com/party')).toBe('https://facebook.com/party');
        expect(formatSocialUrl('facebook', 'http:javascript:alert(1)')).not.toMatch(/^javascript:/i);
        expect(formatSocialUrl('x', 'javascript:alert(1)')).toBe('https://x.com/javascript:alert(1)');
    });
});
