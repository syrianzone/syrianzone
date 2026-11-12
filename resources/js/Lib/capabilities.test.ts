import { describe, expect, it } from 'vitest';
import { CAPABILITIES, canAny, canModule, hasCapability, type Capability } from './capabilities';

/**
 * The capability check itself, exercised over the shapes the server shares.
 *
 * `effective_permissions` is resolved server-side
 * (`User::effectivePermissions()`): a superadmin arrives with the whole
 * catalogue, a staff account with the capabilities its role/grant stores, a
 * plain account with an empty list and a guest with no user at all. There is no
 * role table on this side, so these four fixtures are also the proof that the
 * check does not re-derive one.
 */
const superadmin = [...CAPABILITIES];
const placesReviewer: Capability[] = ['places.review'];
const plainUser: string[] = [];
const guest = undefined;

describe('capability checks', () => {
    it('lets a superadmin do everything the catalogue lists', () => {
        expect(CAPABILITIES.length).toBeGreaterThan(0);

        for (const capability of CAPABILITIES) {
            expect(hasCapability(superadmin, capability)).toBe(true);
        }
    });

    it('lets a role with some capabilities do only those', () => {
        expect(hasCapability(placesReviewer, 'places.review')).toBe(true);
        expect(hasCapability(placesReviewer, 'places.approve')).toBe(false);
        expect(hasCapability(placesReviewer, 'polls.create')).toBe(false);
    });

    it('lets a plain account do nothing', () => {
        expect(hasCapability(plainUser, 'places.review')).toBe(false);
        expect(canAny(plainUser, 'places.review', 'places.approve')).toBe(false);
        expect(canModule(plainUser, 'places')).toBe(false);
    });

    it('lets a guest do nothing', () => {
        expect(hasCapability(guest, 'places.review')).toBe(false);
        expect(hasCapability(null, 'places.review')).toBe(false);
        expect(canModule(guest, 'transit')).toBe(false);
    });

    it('answers "any of" and "any in module" from the same list', () => {
        expect(canAny(placesReviewer, 'places.approve', 'places.review')).toBe(true);
        expect(canAny(placesReviewer, 'places.approve', 'places.edit')).toBe(false);
        expect(canModule(placesReviewer, 'places')).toBe(true);
        expect(canModule(placesReviewer, 'promises')).toBe(false);
    });
});
