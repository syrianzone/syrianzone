import media from '../../data/media.json';

/**
 * The public base of the Cloudflare R2 bucket: every stored media URL in the
 * app (`syofficial/entities/**`, `govapps/**`, `downloads/**`) is built on it.
 * Defaults to `resources/data/media.json`, overridable via `VITE_MEDIA_BASE`.
 */
export const MEDIA_BASE = (
    (import.meta.env?.VITE_MEDIA_BASE as string | undefined) || media.public_base
).replace(/\/+$/, '');

/** Join a relative media key onto `MEDIA_BASE`. */
export function mediaUrl(path: string): string {
    const trimmed = path.replace(/^\/+/, '');
    return `${MEDIA_BASE}/${trimmed}`;
}
