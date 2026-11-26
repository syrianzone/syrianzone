export type MinistryKind = 'ministry' | 'sovereign';

export type MinistryStatus = 'current' | 'merged' | 'split' | 'abolished';

export interface MinistryMeta {
    updated_at: string;
    source_name_ar: string;
    source_url: string;
    source_json_url: string;
}

export interface GovernmentEra {
    id: string;
    label_ar: string;
    short_label_ar: string;
    period_ar: string;
    start_date: string;
    end_date: string | null;
    summary_ar: string;
    source_url: string;
}

export interface MinistryRef {
    slug: string;
    name_ar: string;
    status: MinistryStatus;
    kind: MinistryKind;
}

export interface MinistryHolder {
    name: string;
    title: string;
    era: string;
    start_date: string | null;
    end_date: string | null;
    is_current: boolean;
    decree: string | null;
    notes: string | null;
    source_url: string;
    source_label: string;
    govtcvs_slug: string | null;
    govtcvs_url: string | null;
    portrait_url: string | null;
    bio_summary_ar: string | null;
    office_status: string | null;
    cv_completeness: string | null;
}

export interface MinistryLineageEvent {
    date: string;
    kind: string;
    label_ar: string;
    decree?: string | null;
    related_slugs?: string[];
    related_ministries?: MinistryRef[];
    source_url: string;
}

export interface MinistrySummary {
    slug: string;
    kind: MinistryKind;
    name_ar: string;
    name_en: string;
    status: MinistryStatus;
    sort_order: number;
    official_entity_id: string | null;
    entity_image: string | null;
    entity_description_ar: string | null;
    predecessors: MinistryRef[];
    successors: MinistryRef[];
    lineage_summary_ar: string | null;
    lineage_events?: MinistryLineageEvent[];
    jard_url: string;
    current_holder: MinistryHolder | null;
    holders: MinistryHolder[];
    deputies: MinistryHolder[];
}

export interface MinistryRestructuring {
    id: string;
    date: string;
    kind: string;
    title_ar: string;
    summary_ar: string;
    decree?: string | null;
    from_slugs: string[];
    to_slugs: string[];
    from_ministries: MinistryRef[];
    to_ministries: MinistryRef[];
    source_url: string;
}

export interface MinistryOfficialAccount {
    id: string;
    name_ar: string;
    name_en: string;
    description_ar: string | null;
    image: string | null;
    socials: Record<string, string>;
    syofficial_url: string;
}

export interface MinistryGovApp {
    id: string;
    name_ar: string;
    description_ar: string | null;
    icon: string | null;
    has_guide: boolean;
    url: string;
    website: string | null;
}

export interface MinistryPromise {
    id: string;
    number: number;
    title: string;
    status: string;
    display_state: string;
    statement_date: string | null;
    deadline_date: string | null;
    speaker_name: string;
    speaker_slug: string | null;
    is_current_minister: boolean;
    url: string;
}

export interface MinistrySource {
    label_ar: string;
    url: string;
}

export interface MinistriesIndexProps {
    meta: MinistryMeta;
    eras: GovernmentEra[];
    restructurings: MinistryRestructuring[];
    all_ministries: MinistrySummary[];
    stats: {
        current_ministries: number;
        historical_ministries: number;
        sovereign_bodies: number;
        eras_count: number;
    };
}

export interface MinistryShowProps {
    meta: MinistryMeta;
    eras: GovernmentEra[];
    ministry: MinistrySummary;
    official_accounts: {
        primary: MinistryOfficialAccount | null;
        affiliated: MinistryOfficialAccount[];
    };
    gov_apps: MinistryGovApp[];
    promises: MinistryPromise[];
    sources: MinistrySource[];
    siblings: MinistryRef[];
}

export const MINISTRY_STATUS_LABELS: Record<MinistryStatus, string> = {
    current: 'قائمة حالياً',
    merged: 'مُدمجة',
    split: 'مُقسّمة',
    abolished: 'مُلغاة',
};

export const MINISTRY_KIND_LABELS: Record<MinistryKind, string> = {
    ministry: 'وزارة سورية',
    sovereign: 'هيئة سيادية',
};

export const PROMISE_STATE_LABELS: Record<string, string> = {
    pending: 'قيد المتابعة',
    in_progress: 'قيد التنفيذ',
    fulfilled: 'تحقق',
    partially_fulfilled: 'تحقق جزئياً',
    broken: 'لم يتحقق',
    overdue: 'متأخر',
    postponed: 'مؤجّل',
    retracted: 'مسحوب',
};

export const RESTRUCTURING_KIND_LABELS: Record<string, string> = {
    merge: 'دمج وزاري',
    split: 'فصل وإعادة هيكلة',
    established: 'استحداث وزارة',
    abolished: 'إلغاء منصب',
    reshuffle: 'تعديل حكومي',
    transition: 'تحوّل دستوري',
};

/**
 * Determine whether a holder tenure was active during a given government era.
 * Uses strict boundary comparison so a handover on the exact boundary day
 * (e.g., 2025-03-29 or 2026-05-09) attributes the outgoing holder to the
 * previous era and the incoming holder to the new era.
 */
export function holderActiveInEra(holder: MinistryHolder, era: GovernmentEra): boolean {
    if (holder.era === era.id) return true;
    const hStart = holder.start_date;
    if (!hStart) return false;
    const hEnd = holder.is_current ? '9999-12-31' : (holder.end_date ?? hStart);
    const eStart = era.start_date;
    const eEnd = era.end_date ?? '9999-12-31';

    return hStart < eEnd && hEnd > eStart;
}

export function eraLabelById(eras: GovernmentEra[], eraId: string): string {
    return eras.find((e) => e.id === eraId)?.short_label_ar ?? eraId;
}
