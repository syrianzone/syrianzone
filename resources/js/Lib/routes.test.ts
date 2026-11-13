import { describe, expect, it } from 'vitest';
import {
    isActive,
    isFullBleed,
    isNavbarSticky,
    isUnderPath,
    pathnameOf,
    routeFamily,
    routeSegment,
    siteModuleOf,
} from './routes';

describe('pathnameOf', () => {
    it('drops the query string and the hash', () => {
        expect(pathnameOf('/transit/city/damascus?route=4')).toBe('/transit/city/damascus');
        expect(pathnameOf('/mishwar?place=12#photos')).toBe('/mishwar');
    });

    it('drops trailing and duplicate slashes', () => {
        expect(pathnameOf('/roznama/')).toBe('/roznama');
        expect(pathnameOf('/transit//city/')).toBe('/transit/city');
        expect(pathnameOf('/')).toBe('/');
    });

    it('answers for an empty or missing url', () => {
        expect(pathnameOf('')).toBe('/');
        expect(pathnameOf(undefined)).toBe('/');
        expect(pathnameOf(null)).toBe('/');
        expect(pathnameOf('?tab=profile')).toBe('/');
    });
});

describe('routeFamily', () => {
    it('names the section a page belongs to', () => {
        expect(routeFamily('/roznama')).toBe('roznama');
        expect(routeFamily('/muslim/quran')).toBe('muslim');
        expect(routeFamily('/transit/city/damascus/map')).toBe('transit');
        expect(routeFamily('/games/tarneeb')).toBe('games');
    });

    it('reads a pathname with a query string', () => {
        expect(routeFamily('/muslim/prayer?city=damascus')).toBe('muslim');
    });

    it('returns null outside the catalogue', () => {
        expect(routeFamily('/')).toBeNull();
        expect(routeFamily('/guesswho')).toBeNull();
        expect(routeFamily('/admin/navigation')).toBeNull();
    });

    it('does not match a section on a shared prefix', () => {
        expect(routeFamily('/atlas-extra')).toBeNull();
        expect(routeFamily('/boards')).toBeNull();
    });
});

describe('isUnderPath', () => {
    it('matches the prefix itself and its children only', () => {
        expect(isUnderPath('/transit', '/transit')).toBe(true);
        expect(isUnderPath('/transit/studio', '/transit')).toBe(true);
        expect(isUnderPath('/transitx', '/transit')).toBe(false);
    });
});

describe('isFullBleed', () => {
    it('takes the full viewport for the transit map, studio and admin', () => {
        expect(isFullBleed('/transit/city/damascus')).toBe(true);
        expect(isFullBleed('/transit/city/damascus/map')).toBe(true);
        expect(isFullBleed('/transit/city/damascus/route/12')).toBe(true);
        expect(isFullBleed('/transit/studio')).toBe(true);
        expect(isFullBleed('/transit/admin')).toBe(true);
    });

    it('lets every other page scroll', () => {
        expect(isFullBleed('/transit')).toBe(false);
        expect(isFullBleed('/games/tarneeb')).toBe(false);
        expect(isFullBleed('/mishwar')).toBe(false);
        expect(isFullBleed('/')).toBe(false);
    });
});

describe('isNavbarSticky', () => {
    it('keeps the navbar in the flow for the sections the catalogue says so', () => {
        expect(isNavbarSticky('/muslim/quran')).toBe(false);
        expect(isNavbarSticky('/games/tarneeb')).toBe(false);
    });

    it('is sticky everywhere else', () => {
        expect(isNavbarSticky('/roznama')).toBe(true);
        expect(isNavbarSticky('/admin/navigation')).toBe(true);
    });
});

describe('isActive', () => {
    it('marks the exact page only', () => {
        expect(isActive('/transit', '/transit')).toBe(true);
        expect(isActive('/transit', '/transit/')).toBe(true);
        expect(isActive('/transit', '/transit/city/damascus')).toBe(false);
    });

    it('ignores the query string', () => {
        expect(isActive('/mishwar', '/mishwar?place=3')).toBe(true);
    });

    it('never marks an external link current', () => {
        expect(isActive('https://food.syrian.zone', '/mishwar')).toBe(false);
    });
});

describe('routeSegment', () => {
    it('reads the city id out of a transit city route', () => {
        expect(routeSegment('/transit/city/damascus', '/transit/city')).toBe('damascus');
        expect(routeSegment('/transit/city/damascus/map', '/transit/city')).toBe('damascus');
    });

    it('is null for the prefix itself and for other sections', () => {
        expect(routeSegment('/transit/city', '/transit/city')).toBeNull();
        expect(routeSegment('/transit/studio', '/transit/city')).toBeNull();
    });
});

describe('siteModuleOf', () => {
    it('picks the longest catalogue match', () => {
        expect(siteModuleOf('/muslim/quran')?.id).toBe('muslim');
        expect(siteModuleOf('/syrian-contributors')?.id).toBe('contributors');
    });
});
