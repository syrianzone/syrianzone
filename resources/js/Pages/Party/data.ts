export type SocialPlatform = 'x' | 'instagram' | 'facebook' | 'youtube' | 'telegram';

/**
 * Organisation links come from submitted data: only an absolute http(s) URL
 * may reach an href (a `javascript:` or `data:` URL would run on click).
 * Returns '' for anything else.
 */
export function safeHttpUrl(value: string | null | undefined): string {
    if (!value) return '';
    let raw = value.trim();
    // A bare domain ("www.party.org") in the sheet means an https site.
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw) && /^[\w-]+(\.[\w-]+)+(\/|$)/.test(raw)) raw = `https://${raw}`;
    try {
        const url = new URL(raw);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch {
        return '';
    }
}

export function formatSocialUrl(platform: SocialPlatform, handle: string): string {
    if (!handle) return '';
    if (handle.startsWith('http')) return safeHttpUrl(handle);

    // Always lands on the platform's own https origin, whatever the handle holds.
    const cleanHandle = handle.trim().replace(/^@/, '');

    switch (platform) {
        case 'x': return `https://x.com/${cleanHandle}`;
        case 'instagram': return `https://instagram.com/${cleanHandle}`;
        case 'facebook': return `https://facebook.com/${cleanHandle}`;
        case 'youtube': return `https://youtube.com/${cleanHandle}`;
        case 'telegram': return `https://t.me/${cleanHandle}`;
        default: return '';
    }
}

export function getLanguageName(code: string): string {
    const map: { [key: string]: string } = {
        'AR': 'العربية',
        'EN': 'English',
        'KU': 'Kurdish',
        'TR': 'Turkish'
    };
    return map[code] || code;
}
