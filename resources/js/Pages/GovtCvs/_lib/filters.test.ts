import { describe, expect, it } from 'vitest';
import type { SmartFilterValue } from '@/Lib/smartFilterSearch';
import type { GovtOfficialSummary, GovtTenureItem } from '@/Domain/govtcvs/types';
import {
    activeScoreboardTile,
    filterOfficials,
    govtFilterFacets,
    govtListUrl,
    matchesStatus,
    readGovtFilters,
    selectScoreboardTile,
    visibleOfficials,
} from './filters';

const facets = govtFilterFacets([
    { id: 'min-energy', name_ar: 'وزارة الطاقة' },
    { id: 'min-foreign', name_ar: 'وزارة الخارجية والمغتربين' },
]);

const empty: SmartFilterValue = { search: '', filters: {}, sort: 'default' };

const makeTenure = (patch: Partial<GovtTenureItem> = {}): GovtTenureItem => ({
    id: 'tenure-1',
    official_id: 'off-1',
    office_slot_id: null,
    office_slot_slug: null,
    office_slot_title_ar: null,
    institution_id: 'min-energy',
    institution_name_ar: 'وزارة الطاقة',
    role_title_ar: 'وزير الطاقة',
    tier: 'minister',
    government_phase: 'transitional_2025',
    status: 'current',
    started_at: '2025-03-29',
    start_date_precision: 'exact',
    start_decree_ref: null,
    ended_at: null,
    end_date_precision: null,
    end_reason: null,
    end_decree_ref: null,
    first_operational_seen_at: null,
    last_operational_seen_at: null,
    operational_mentions_count: 0,
    is_acting: false,
    notes_ar: null,
    predecessor: null,
    successor: null,
    ...patch,
});

const makeOfficial = (id: string, patch: Partial<GovtOfficialSummary> = {}): GovtOfficialSummary => {
    const tenure = makeTenure({ official_id: id });
    return {
        id,
        slug: `official-${id}`,
        full_name_ar: 'محمد البشير',
        display_name_ar: 'محمد البشير',
        full_name_en: 'Mohammed Al-Bashir',
        honorific_ar: 'م.',
        office_status: 'in_office',
        highest_tier: 'minister',
        birth_year: null,
        birth_place_ar: null,
        gender: null,
        bio_summary_ar: null,
        portrait_url: null,
        resolved_portrait_url: null,
        cv_completeness: 'full_cv',
        verification_level: 'decree_verified',
        publish_status: 'published',
        first_seen_in_office_at: '2025-03-29',
        last_seen_in_office_at: null,
        current_tenure: tenure,
        latest_tenure: tenure,
        tenures_count: 1,
        cv_entries_count: 2,
        evidence_count: 1,
        version: 1,
        updated_at: null,
        ...patch,
    };
};

const officials = [
    makeOfficial('1'),
    makeOfficial('2', {
        full_name_ar: 'أسعد الشيباني',
        display_name_ar: 'أسعد الشيباني',
        office_status: 'in_office',
        highest_tier: 'minister',
        cv_completeness: 'full_cv',
        tenures_count: 3,
        current_tenure: makeTenure({
            official_id: '2',
            institution_id: 'min-foreign',
            institution_name_ar: 'وزارة الخارجية والمغتربين',
            role_title_ar: 'وزير الخارجية والمغتربين',
            started_at: '2024-12-21',
        }),
        latest_tenure: makeTenure({
            official_id: '2',
            institution_id: 'min-foreign',
            institution_name_ar: 'وزارة الخارجية والمغتربين',
            role_title_ar: 'وزير الخارجية والمغتربين',
            started_at: '2024-12-21',
        }),
    }),
    makeOfficial('3', {
        full_name_ar: 'ماهر مروان',
        display_name_ar: 'ماهر مروان',
        office_status: 'out_of_office',
        highest_tier: 'governor',
        cv_completeness: 'positions_only',
        tenures_count: 1,
        current_tenure: null,
        latest_tenure: makeTenure({
            official_id: '3',
            institution_id: null,
            institution_name_ar: 'محافظة دمشق',
            role_title_ar: 'محافظ دمشق',
            tier: 'governor',
            government_phase: 'caretaker_2024',
            status: 'ended',
            started_at: '2024-12-15',
            ended_at: '2025-05-01',
        }),
    }),
];

describe('govtcvs URL query sync', () => {
    it('round-trips status, tier, institution, phase, cv_completeness, q, and sort', () => {
        const value: SmartFilterValue = {
            search: 'الخارجية',
            sort: 'newest',
            filters: {
                status: ['in_office'],
                tier: ['minister', 'governor'],
                institution: ['min-foreign'],
                phase: ['transitional_2025'],
                cv_completeness: ['full_cv'],
            },
        };
        expect(readGovtFilters(govtListUrl(value), facets)).toEqual(value);
    });

    it('accepts institution_id alias and legacy tier group parameters', () => {
        const parsed = readGovtFilters(
            '/govtcvs?institution_id=min-energy&tier=judicial_security',
            facets,
        );
        expect(parsed.filters).toEqual({
            institution: ['min-energy'],
            tier: ['judicial', 'military_security'],
        });
    });
});

describe('govtcvs filtering and sorting', () => {
    it('filters by tier, institution, phase, cv_completeness, and folded Arabic search', () => {
        const value: SmartFilterValue = {
            ...empty,
            search: 'اسعد',
            filters: { institution: ['min-foreign'] },
        };
        const base = filterOfficials(officials, value);
        expect(base.map((o) => o.id)).toEqual(['2']);
        expect(visibleOfficials(base, value).map((o) => o.id)).toEqual(['2']);
    });

    it('keeps status filtering in visibleOfficials so base status counts stay accurate', () => {
        const value: SmartFilterValue = {
            ...empty,
            filters: { status: ['out_of_office'] },
        };
        const base = filterOfficials(officials, value);
        expect(base).toHaveLength(3);
        expect(visibleOfficials(base, value).map((o) => o.id)).toEqual(['3']);
        expect(matchesStatus(officials[2], 'out_of_office')).toBe(true);
    });

    it('sorts by newest appointment, tenures count, and alphabetically', () => {
        expect(visibleOfficials(officials, { ...empty, sort: 'newest' }).map((o) => o.id)).toEqual([
            '1',
            '2',
            '3',
        ]);
        expect(visibleOfficials(officials, { ...empty, sort: 'tenures' }).map((o) => o.id)).toEqual([
            '2',
            '3',
            '1',
        ]);
        expect(visibleOfficials(officials, { ...empty, sort: 'alpha' }).map((o) => o.id)).toEqual([
            '2',
            '3',
            '1',
        ]);
    });
});

describe('govtcvs scoreboard tiles', () => {
    it('identifies active scoreboard tiles accurately', () => {
        expect(activeScoreboardTile(empty)).toBeNull();
        expect(activeScoreboardTile({ ...empty, filters: { status: ['in_office'] } })).toBe(
            'in_office',
        );
        expect(activeScoreboardTile({ ...empty, filters: { status: ['out_of_office'] } })).toBe(
            'out_of_office',
        );
        expect(activeScoreboardTile({ ...empty, filters: { cv_completeness: ['full_cv'] } })).toBe(
            'full_cv',
        );
        expect(activeScoreboardTile({ ...empty, search: 'بشير', filters: { status: ['in_office'] } })).toBeUndefined();
    });

    it('toggles scoreboard tiles and resets on total click', () => {
        const inOffice = selectScoreboardTile(empty, 'in_office');
        expect(inOffice.filters).toEqual({ status: ['in_office'] });
        expect(selectScoreboardTile(inOffice, 'in_office').filters).toEqual({});
        expect(selectScoreboardTile(inOffice, null).filters).toEqual({});
        expect(selectScoreboardTile(inOffice, 'full_cv').filters).toEqual({
            cv_completeness: ['full_cv'],
        });
    });
});
