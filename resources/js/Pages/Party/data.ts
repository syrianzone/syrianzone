export function formatSocialUrl(platform: 'x' | 'instagram' | 'facebook' | 'youtube' | 'telegram', handle: string): string {
    if (!handle) return '';
    if (handle.startsWith('http')) return handle;

    const cleanHandle = handle.replace(/^@/, '');

    switch (platform) {
        case 'x': return `https://x.com/${cleanHandle}`;
        case 'instagram': return `https://instagram.com/${cleanHandle}`;
        case 'facebook': return `https://facebook.com/${cleanHandle}`;
        case 'youtube': return `https://youtube.com/${cleanHandle}`;
        case 'telegram': return `https://t.me/${cleanHandle}`;
        default: return handle;
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
