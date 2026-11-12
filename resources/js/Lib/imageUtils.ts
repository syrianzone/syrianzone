/**
 * Image helper utility for Cloudflare R2 image display and original downloads.
 */

/**
 * Returns the URL to display for an R2 / Cloudflare hosted image.
 * The CDN serves the image as stored; there is no server-side resize to ask for.
 */
export function getDisplayImageUrl(url?: string | null): string {
    return url ?? '';
}

/**
 * Returns the uncompressed original high-resolution image URL for downloading.
 */
export function getOriginalImageUrl(candidate: { originalUrl?: string; imageUrl?: string; image_url?: string }): string {
    const rawUrl = candidate.originalUrl || candidate.imageUrl || candidate.image_url || '';

    // Strip Cloudflare transformation prefix if present to get original file
    if (rawUrl.includes('/cdn-cgi/image/')) {
        const parts = rawUrl.split('/cdn-cgi/image/');
        const rest = parts[1].substring(parts[1].indexOf('/'));
        return `${parts[0]}${rest}`;
    }

    return rawUrl;
}
