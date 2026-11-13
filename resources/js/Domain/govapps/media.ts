import media from '../../../data/media.json';

/**
 * The public base of the Cloudflare R2 bucket: every stored media URL in the
 * app (`syofficial/entities/**`, `govapps/**`, `downloads/**`) is built on it.
 * From `resources/data/media.json`; `R2_PUBLIC_URL` overrides it server-side.
 */
export const MEDIA_BASE = media.public_base.replace(/\/+$/, '');

/** Shown when a government app has no icon of its own. */
export const DEFAULT_GOVAPP_ICON = `${MEDIA_BASE}/govapps/mofa/icon.webp`;
