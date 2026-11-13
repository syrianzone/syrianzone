import raw from '../../../../../data/promises-admin-sections.json';
import { CAPABILITIES, type Capability } from '@/Lib/capabilities';

/**
 * The promises admin sections: each nav entry's page and the capability its
 * route requires — one record in `resources/data/promises-admin-sections.json`,
 * read here and by `tests/Feature/PromisesAdminSectionsTest.php`, which fails
 * when a route's guard and this table disagree.
 *
 * `any` is not a capability: it is the module shell's middleware argument
 * ("holds any promises.* capability"), and the nav shows that entry to every
 * visitor of the section.
 */
export const SECTION_KEYS = ['promises', 'review', 'speakers', 'sectors'] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export interface Section {
    /** The page route this section links to. */
    page: string;
    /** The capability the route is tagged with, or `any` for the module shell. */
    capability: Capability | 'any';
}

function isSectionCapability(value: string): value is Capability | 'any' {
    return value === 'any' || CAPABILITIES.some((known) => known === value);
}

function section(key: SectionKey, page: string, capability: string): Section {
    if (!isSectionCapability(capability)) {
        throw new Error(
            `resources/data/promises-admin-sections.json: "${key}" names the unknown capability "${capability}"`,
        );
    }

    return { page, capability };
}

export const SECTIONS: Record<SectionKey, Section> = {
    promises: section('promises', raw.promises.page, raw.promises.capability),
    review: section('review', raw.review.page, raw.review.capability),
    speakers: section('speakers', raw.speakers.page, raw.speakers.capability),
    sectors: section('sectors', raw.sectors.page, raw.sectors.capability),
};
