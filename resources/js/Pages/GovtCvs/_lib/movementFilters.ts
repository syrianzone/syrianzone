import { normalizeArabic } from '@/Lib/arabic';
import type { SmartFilterFacet, SmartFilterOption, SmartFilterValue } from '@/Lib/smartFilterSearch';
import { END_REASON_META, MOVEMENT_KIND_META } from '@/Domain/govtcvs/constants';
import type { GovtMovementItem, InstitutionOption } from '@/Domain/govtcvs/types';
import { PHASE_FILTERS, TIER_FILTERS } from './filters';

export const MOVEMENT_KIND_FILTERS: readonly SmartFilterOption[] = [
    { value: 'appointment', label: 'تعيينات' },
    { value: 'transition', label: MOVEMENT_KIND_META.transition.label },
    { value: 'exit', label: MOVEMENT_KIND_META.exit.label },
];

export const END_REASON_FILTERS: readonly SmartFilterOption[] = Object.values(END_REASON_META).map(
    (item) => ({
        value: item.key,
        label: item.label,
    }),
);

export const MOVEMENT_SORT_OPTIONS: readonly SmartFilterOption[] = [
    { value: 'newest', label: 'الأحدث أولاً' },
    { value: 'oldest', label: 'الأقدم أولاً' },
    { value: 'alpha', label: 'أبجدياً' },
];

export function movementFilterFacets(
    institutions: readonly InstitutionOption[],
): SmartFilterFacet[] {
    const facets: SmartFilterFacet[] = [
        { key: 'kind', label: 'نوع الحركة', aliases: ['النوع', 'نوع', 'حركة'], options: MOVEMENT_KIND_FILTERS },
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
        {
            key: 'end_reason',
            label: 'سبب الانتهاء',
            aliases: ['السبب', 'سبب', 'إعفاء', 'استقالة'],
            options: END_REASON_FILTERS,
        },
    );
    return facets.map((facet) => ({ ...facet, selectionMode: 'multiple' }));
}

const LEGACY_TIER_GROUP_MAP: Record<string, string[]> = {
    judicial_security: ['judicial', 'military_security'],
    advisory: ['advisory', 'diplomat', 'director'],
};

/** Accept scalar links and PHP arrays, including Inertia's normalized indices and `institution_id` alias. */
export function readMovementFilters(
    url: string,
    facets: readonly SmartFilterFacet[],
    serverFilters?: {
        q?: string | null;
        kind?: string | null;
        tier?: string | null;
        institution?: string | null;
        institution_id?: string | null;
        phase?: string | null;
        end_reason?: string | null;
        sort?: string | null;
    },
): SmartFilterValue {
    const params = new URL(url, 'https://local.invalid').searchParams;
    const filters: SmartFilterValue['filters'] = {};

    for (const facet of facets) {
        const paramKeys =
            facet.key === 'institution' ? ['institution', 'institution_id'] : [facet.key];
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
        const valid = [...new Set(expanded)].filter((v) =>
            facet.options.some((o) => o.value === v),
        );
        if (valid.length > 0) {
            filters[facet.key] = valid;
        }
    }

    const qParam = params.get('q') ?? serverFilters?.q ?? '';
    const sortParam = params.get('sort') ?? serverFilters?.sort ?? 'newest';

    return {
        search: qParam.trim(),
        sort: MOVEMENT_SORT_OPTIONS.some((o) => o.value === sortParam) ? sortParam : 'newest',
        filters,
    };
}

export function movementsListUrl(value: SmartFilterValue): string {
    const params = new URLSearchParams();
    for (const [key, values] of Object.entries(value.filters)) {
        for (const option of values) {
            params.append(values.length > 1 ? `${key}[]` : key, option);
        }
    }
    const q = value.search.trim();
    if (q) params.set('q', q);
    if (value.sort !== 'newest') params.set('sort', value.sort);
    return `/govtcvs/movements${params.size ? `?${params}` : ''}`;
}

export function matchesMovementKind(movement: GovtMovementItem, kind: string): boolean {
    return movement.movement_kind === kind;
}

/** Leave `kind` filtering to `visibleMovements` so top kind-chip counts use this full base set. */
export function filterMovements(
    movements: readonly GovtMovementItem[],
    value: SmartFilterValue,
): GovtMovementItem[] {
    const needle = normalizeArabic(value.search);
    const any = (key: string, matches: (v: string) => boolean) =>
        !value.filters[key]?.length || value.filters[key].some(matches);

    return movements.filter((item) => {
        if (!any('tier', (v) => item.tier === v)) {
            return false;
        }
        if (!any('institution', (v) => item.institution_id === v)) {
            return false;
        }
        if (!any('phase', (v) => item.government_phase === v)) {
            return false;
        }
        if (!any('end_reason', (v) => item.end_reason === v)) {
            return false;
        }
        if (needle) {
            const haystack = normalizeArabic(
                [
                    item.official_honorific_ar,
                    item.official_name_ar,
                    item.role_title_ar,
                    item.institution_name_ar,
                    item.decree_ref,
                    item.predecessor?.official_name_ar,
                    item.successor?.official_name_ar,
                ]
                    .filter(Boolean)
                    .join(' '),
            );
            if (!haystack.includes(needle)) return false;
        }
        return true;
    });
}

export function visibleMovements(
    base: readonly GovtMovementItem[],
    value: SmartFilterValue,
): GovtMovementItem[] {
    const list = base.filter(
        (movement) =>
            !value.filters.kind?.length ||
            value.filters.kind.some((k) => matchesMovementKind(movement, k)),
    );

    if (value.sort === 'oldest') {
        return list.toSorted((a, b) => (a.date ?? '9999-99-99').localeCompare(b.date ?? '9999-99-99'));
    }

    if (value.sort === 'alpha') {
        return list.toSorted((a, b) => a.official_name_ar.localeCompare(b.official_name_ar, 'ar'));
    }

    return list.toSorted((a, b) => (b.date ?? '0000-00-00').localeCompare(a.date ?? '0000-00-00'));
}
