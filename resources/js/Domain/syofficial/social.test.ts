import { describe, expect, it } from 'vitest';
import { socialVisual } from './social';
import platforms from '../../../../resources/data/social-platforms.json';

/**
 * A platform is added or removed in `resources/data/social-platforms.json`; the
 * icon map in `social.ts` cannot be derived from JSON at compile time, so this
 * is the check that a new key is painted rather than silently linking nowhere.
 */
describe('social platform vocabulary', () => {
    const fallback = socialVisual('__not-a-platform__');

    it('paints every platform in the data file', () => {
        for (const platform of platforms) {
            expect(socialVisual(platform.key), platform.key).not.toBe(fallback);
        }
    });

    it('gives a secondary platform the same treatment as its primary', () => {
        const secondary = platforms.filter((platform) => platform.key.endsWith('_secondary'));
        expect(secondary.length).toBeGreaterThan(0);

        for (const platform of secondary) {
            const primary = platform.key.replace(/_secondary$/, '');
            expect(socialVisual(platform.key), platform.key).toEqual(socialVisual(primary));
        }
    });

    it('falls back to one painted icon for a key no one knows', () => {
        const unknown = socialVisual('mastodon');

        // A link nobody has described still draws: a generic icon, not nothing.
        expect(unknown.Icon).toBeDefined();
        expect(unknown).toEqual(socialVisual('__also-unknown__'));
        for (const platform of platforms) {
            expect(unknown, platform.key).not.toEqual(socialVisual(platform.key));
        }
    });
});
