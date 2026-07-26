/**
 * Image helper utility for Cloudflare R2 image display optimization & original downloads.
 */

/**
 * Returns a display-optimized thumbnail URL for R2 / Cloudflare hosted images.
 * If the image is hosted on Cloudflare R2 / Custom Domain, appends image transform parameters.
 */
export function getDisplayImageUrl(url?: string | null, width = 250): string {
    if (!url) return '';

    // If already a data URI or blob URL, return as is
    if (url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }

    // Cloudflare Image Resizing transformation prefix
    // E.g. https://cdn.syrian.zone/tierlist/candidates/jolani75.png -> https://cdn.syrian.zone/cdn-cgi/image/width=250,fit=cover,format=auto/tierlist/candidates/jolani75.png
    if (url.includes('cdn.syrian.zone') || url.includes('/tierlist/candidates/')) {
        // Avoid double transformations
        if (url.includes('/cdn-cgi/image/')) {
            return url;
        }

        try {
            const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://syrian.zone');
            return `${parsed.origin}/cdn-cgi/image/width=${width},fit=cover,format=auto${parsed.pathname}`;
        } catch {
            return url;
        }
    }

    return url;
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
