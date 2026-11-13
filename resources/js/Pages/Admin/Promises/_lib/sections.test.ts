import { describe, expect, it } from 'vitest';
import { SECTIONS, SECTION_KEYS } from './sections';

// The table comes from resources/data/promises-admin-sections.json behind a
// capability check that throws on an unknown id, so importing it already fails
// when the file drifts. The route tags themselves are pinned by
// tests/Feature/PromisesAdminSectionsTest.php, which reads the same file.
describe('the promises admin sections', () => {
    it('has a page and a known capability for every section', () => {
        expect(Object.keys(SECTIONS).sort()).toEqual([...SECTION_KEYS].sort());

        for (const key of SECTION_KEYS) {
            expect(SECTIONS[key].page, key).toMatch(/^\/admin\/promises(\/[a-z]+)?$/);
            expect(SECTIONS[key].capability, key).not.toBe('');
        }
    });
});
