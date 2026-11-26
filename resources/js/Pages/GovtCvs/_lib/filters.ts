import { normalizeArabic } from '@/Lib/arabic';
import type { SmartFilterFacet, SmartFilterOption, SmartFilterValue } from '@/Lib/smartFilterSearch';
import {
    CV_COMPLETENESS_META,
    OFFICE_STATUS_META,
    PHASE_META,
    TIER_META,
} from '@/Domain/govtcvs/constants';
import type { GovtOfficialSummary, InstitutionOption } from '@/Domain/govtcvs/types';

export type GovtScoreboardTile = 'in_office' | 'out_of_office' | 'full_cv' | 'movements';

export const STATUS_FILTERS: readonly SmartFilterOption[] = [
    { value: 'in_office', label: OFFICE_STATUS_META.in_office.label },
    { value: 'out_of_office', label: OFFICE_STATUS_META.out_of_office.label },
    { value: 'uncertain', label: 'غير مؤكد' },
    { value: 'deceased', label: OFFICE_STATUS_META.deceased.label },
];

export const TIER_FILTERS: readonly SmartFilterOption[] = Object.values(TIER_META).map((item) => ({
    value: item.key,
    label: item.shortLabel ?? item.label,
}));

export const PHASE_FILTERS: readonly SmartFilterOption[] = Object.values(PHASE_META).map((item) => ({
    value: item.key,
    label: item.label,
}));

export const CV_COMPLETENESS_FILTERS: readonly SmartFilterOption[] = Object.values(CV_COMPLETENESS_META).map((item) => ({
    value: item.key,
    label: item.label,
}));

export const SORT_OPTIONS: readonly SmartFilterOption[] = [
    { value: 'default', label: 'الافتراضي' },
    { value: 'newest', label: 'الأحدث تعييناً' },
    { value: 'tenures', label: 'الأكثر مناصب' },
    { value: 'alpha', label: 'أبجدياً' },
];

export function govtFilterFacets(institutions: readonly InstitutionOption[]): SmartFilterFacet[] {
    const facets: SmartFilterFacet[] = [
        { key: 'status', label: 'الحالة', aliases: ['حالة'], options: STATUS_FILTERS },
        { key: 'tier', label: 'المستوى الوظيفي', aliases: ['المستوى', 'مستوى'], options: TIER_FILTERS },
    ];
    if (institutions.length > 0) {
        facets.push({
            key: 'institution',
            label: 'الجهة الحكومية',
            aliases: ['الجهة', 'جهة', 'وزارة', 'هيئة'],
            options: institutions.map((inst) => ({ value: inst.id, label: inst.name_ar })),
        });
    }
    facets.push(
        { key: 'phase', label: 'المرحلة الحكومية', aliases: ['المرحلة', 'مرحلة'], options: PHASE_FILTERS },
        { key: 'cv_completeness', label: 'اكتمال السيرة', aliases: ['اكتمال', 'توثيق', 'السيرة'], options: CV_COMPLETENESS_FILTERS },
    );
    return facets.map((facet) => ({ ...facet, selectionMode: 'multiple' }));
}

const LEGACY_TIER_GROUP_MAP: Record<string, string[]> = {
    judicial_security: ['judicial', 'military_security'],
    advisory: ['advisory', 'diplomat', 'director'],
};

/** Accept scalar links and PHP arrays, including Inertia's normalized indices and `institution_id` alias. */
export function readGovtFilters(
    url: string,
    facets: readonly SmartFilterFacet[],
    serverFilters?: {
        q?: string | null;
        status?: string | null;
        tier?: string | null;
        institution?: string | null;
        institution_id?: string | null;
        phase?: string | null;
        cv_completeness?: string | null;
        sort?: string | null;
    },
): SmartFilterValue {
    const params = new URL(url, 'https://local.invalid').searchParams;
    const filters: SmartFilterValue['filters'] = {};

    for (const facet of facets) {
        const paramKeys = facet.key === 'institution' ? ['institution', 'institution_id'] : [facet.key];
        const candidates: string[] = [];

        for (const [key, val] of params) {
            for (const pk of paramKeys) {
                if (
                    key === pk ||
                    key === `${pk}[]` ||
                    (key.startsWith(`${pk}[`) && /^\d+\]$/.test(key.slice(pk.length + 1)))
                ) {
                    candidates.push(val);
                }
            }
        }

        if (candidates.length === 0 && serverFilters) {
            const fallback =
                facet.key === 'institution'
                    ? (serverFilters.institution ?? serverFilters.institution_id)
                    : serverFilters[facet.key as keyof typeof serverFilters];
            if (fallback) candidates.push(fallback);
        }

        const expanded = candidates.flatMap((c) =>
            facet.key === 'tier' && LEGACY_TIER_GROUP_MAP[c] ? LEGACY_TIER_GROUP_MAP[c] : [c],
        );
        const valid = [...new Set(expanded)].filter((v) => facet.options.some((o) => o.value === v));
        if (valid.length > 0) {
            filters[facet.key] = valid;
        }
    }

    const qParam = params.get('q') ?? serverFilters?.q ?? '';
    const sortParam = params.get('sort') ?? serverFilters?.sort ?? 'default';

    return {
        search: qParam.trim(),
        sort: SORT_OPTIONS.some((o) => o.value === sortParam) ? sortParam : 'default',
        filters,
    };
}

export function govtListUrl(value: SmartFilterValue): string {
    const params = new URLSearchParams();
    for (const [key, values] of Object.entries(value.filters)) {
        for (const option of values) {
            params.append(values.length > 1 ? `${key}[]` : key, option);
        }
    }
    const q = value.search.trim();
    if (q) params.set('q', q);
    if (value.sort !== 'default') params.set('sort', value.sort);
    return `/govtcvs${params.size ? `?${params}` : ''}`;
}

export function matchesStatus(official: GovtOfficialSummary, status: string): boolean {
    return official.office_status === status;
}

/**
 * The scoreboard tile the list shows, if any:
 * - `null` when unfiltered
 * - `'in_office'` / `'out_of_office'` when filtering solely by that status
 * - `'full_cv'` when filtering solely by `cv_completeness = ['full_cv']`
 * - `undefined` for any other combination
 */
export function activeScoreboardTile(value: SmartFilterValue): GovtScoreboardTile | null | undefined {
    if (value.search.trim()) return undefined;
    const keys = Object.keys(value.filters).filter((key) => value.filters[key].length > 0);
    if (keys.length === 0) return null;
    if (keys.length === 1 && keys[0] === 'status' && value.filters.status.length === 1) {
        const s = value.filters.status[0];
        if (s === 'in_office' || s === 'out_of_office') return s;
    }
    if (
        keys.length === 1 &&
        keys[0] === 'cv_completeness' &&
        value.filters.cv_completeness.length === 1 &&
        value.filters.cv_completeness[0] === 'full_cv'
    ) {
        return 'full_cv';
    }
    return undefined;
}

/**
 * Scoreboard counts are global, so a tile narrows the list to its criterion alone,
 * keeping only the sort; selecting the tile already shown returns to the full list.
 */
export function selectScoreboardTile(
    value: SmartFilterValue,
    tile: GovtScoreboardTile | null,
): SmartFilterValue {
    const shown = tile === null || activeScoreboardTile(value) === tile;
    if (shown) {
        return { search: '', sort: value.sort, filters: {} };
    }
    if (tile === 'full_cv') {
        return { search: '', sort: value.sort, filters: { cv_completeness: ['full_cv'] } };
    }
    if (tile === 'in_office' || tile === 'out_of_office') {
        return { search: '', sort: value.sort, filters: { status: [tile] } };
    }
    return { search: '', sort: value.sort, filters: {} };
}

export function hasActiveGovtFilters(value: SmartFilterValue): boolean {
    return (
        value.search.trim() !== '' ||
        Object.values(value.filters).some((values) => values.length > 0)
    );
}

/** Leave status filtering to `visibleOfficials` so status counts use this full base set. */
export function filterOfficials(
    officials: readonly GovtOfficialSummary[],
    value: SmartFilterValue,
): GovtOfficialSummary[] {
    const needle = normalizeArabic(value.search);
    const any = (key: string, matches: (v: string) => boolean) =>
        !value.filters[key]?.length || value.filters[key].some(matches);

    return officials.filter((official) => {
        const activeTenure = official.active_tenure;
        const tenureTier = activeTenure?.tier;
        const activePhase = activeTenure?.government_phase;
        const instId = activeTenure?.institution_id;

        if (!any('tier', (v) => official.highest_tier === v || tenureTier === v)) {
            return false;
        }
        if (!any('institution', (v) => instId === v)) {
            return false;
        }
        if (!any('phase', (v) => activePhase === v)) {
            return false;
        }
        if (!any('cv_completeness', (v) => official.cv_completeness === v)) {
            return false;
        }
        if (needle) {
            const haystack = normalizeArabic(
                [
                    official.full_name_ar,
                    official.display_name_ar,
                    official.full_name_en,
                    official.honorific_ar,
                    official.bio_summary_ar,
                    official.birth_place_ar,
                    activeTenure?.role_title_ar,
                    activeTenure?.institution_name_ar,
                ]
                    .filter(Boolean)
                    .join(' '),
            );
            if (!haystack.includes(needle)) return false;
        }
        return true;
    });
}

export function visibleOfficials(
    base: readonly GovtOfficialSummary[],
    value: SmartFilterValue,
): GovtOfficialSummary[] {
    const list = base.filter(
        (official) =>
            !value.filters.status?.length ||
            value.filters.status.some((s) => matchesStatus(official, s)),
    );

    if (value.sort === 'newest') {
        return [...list].sort((a, b) => {
            const dateA =
                a.active_tenure?.started_at ??
                a.first_seen_in_office_at ??
                '0000-00-00';
            const dateB =
                b.active_tenure?.started_at ??
                b.first_seen_in_office_at ??
                '0000-00-00';
            return dateB.localeCompare(dateA);
        });
    }

    if (value.sort === 'tenures') {
        return [...list].sort((a, b) => {
            if (b.tenures_count !== a.tenures_count) {
                return b.tenures_count - a.tenures_count;
            }
            return (a.display_name_ar || a.full_name_ar).localeCompare(
                b.display_name_ar || b.full_name_ar,
                'ar',
            );
        });
    }

    if (value.sort === 'alpha') {
        return [...list].sort((a, b) =>
            (a.display_name_ar || a.full_name_ar).localeCompare(
                b.display_name_ar || b.full_name_ar,
                'ar',
            ),
        );
    }

    return list;
}
