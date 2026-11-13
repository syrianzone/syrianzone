import { MEDIA_BASE } from '@/Domain/govapps/media';

const R2_BASE = `${MEDIA_BASE}/syofficial/entities/`;

/**
 * Resolve an officials-directory image to a URL. Entries may store a full URL,
 * a site-relative asset path, or a bare filename that lives on R2.
 *
 * Shared by the officials directory, its admin and the promises tracker, so
 * none of them imports another page's module.
 */
export function formatEntityImage(img: string | null | undefined): string {
    if (!img || img.trim().length === 0) return '/placeholder-user.jpg';
    if (img.startsWith('http://') || img.startsWith('https://')) return img;
    if (img.startsWith('/assets/') || img.startsWith('/storage/')) return img;
    const filename = img.split('/').pop() || img;
    return `${R2_BASE}${filename}`;
}
