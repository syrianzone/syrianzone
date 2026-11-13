/** The CDN serves the image as stored; there is no server-side resize to ask for. */
export function getDisplayImageUrl(url?: string | null): string {
    return url ?? '';
}

export function getOriginalImageUrl(candidate: { originalUrl?: string; imageUrl?: string; image_url?: string }): string {
    const rawUrl = candidate.originalUrl || candidate.imageUrl || candidate.image_url || '';

    if (rawUrl.includes('/cdn-cgi/image/')) {
        const parts = rawUrl.split('/cdn-cgi/image/');
        const rest = parts[1].substring(parts[1].indexOf('/'));
        return `${parts[0]}${rest}`;
    }

    return rawUrl;
}
