/** Payload shapes for the Government CVs & Tenure Tracker (السير الذاتية للمسؤولين). */

export const GOVT_OFFICE_STATUS_KEYS = [
    'in_office',
    'out_of_office',
    'uncertain',
    'deceased',
] as const;

export type GovtOfficeStatus = (typeof GOVT_OFFICE_STATUS_KEYS)[number];

export const GOVT_TIER_KEYS = [
    'presidency',
    'minister',
    'governor',
    'agency_head',
    'deputy_minister',
    'judicial',
    'advisory',
    'military_security',
    'diplomat',
    'director',
] as const;

export type GovtTier = (typeof GOVT_TIER_KEYS)[number];

export const GOVT_PHASE_KEYS = [
    'caretaker_2024',
    'transitional_2025',
    'reshuffle_2026',
    'other',
] as const;

export type GovtPhase = (typeof GOVT_PHASE_KEYS)[number];

export const GOVT_TENURE_STATUS_KEYS = [
    'current',
    'ended',
    'uncertain',
] as const;

export type GovtTenureStatus = (typeof GOVT_TENURE_STATUS_KEYS)[number];

export const GOVT_END_REASON_KEYS = [
    'replaced',
    'reassigned',
    'promoted',
    'dismissed',
    'resigned',
    'post_abolished',
    'ministry_merged',
    'cabinet_transition',
    'deceased',
] as const;

export type GovtEndReason = (typeof GOVT_END_REASON_KEYS)[number];

export const GOVT_CV_SECTION_KEYS = [
    'education',
    'career_history',
    'military_revolutionary',
    'civic_social',
    'certification',
    'publication',
] as const;

export type GovtCvSection = (typeof GOVT_CV_SECTION_KEYS)[number];

export const GOVT_CV_COMPLETENESS_KEYS = [
    'full_cv',
    'partial_bio',
    'positions_only',
] as const;

export type GovtCvCompleteness = (typeof GOVT_CV_COMPLETENESS_KEYS)[number];

export const GOVT_EVIDENCE_TYPE_KEYS = [
    'cv_card',
    'appointment_decree',
    'dismissal_decree',
    'handover_farewell',
    'operational_mention',
    'video_interview',
    'external_source',
] as const;

export type GovtEvidenceType = (typeof GOVT_EVIDENCE_TYPE_KEYS)[number];

export const GOVT_PUBLISH_STATUS_KEYS = [
    'draft',
    'published',
    'archived',
] as const;

export type GovtPublishStatus = (typeof GOVT_PUBLISH_STATUS_KEYS)[number];

export const GOVT_VERIFICATION_LEVEL_KEYS = [
    'decree_verified',
    'cv_card_verified',
    'operational_verified',
    'editorial',
] as const;

export type GovtVerificationLevel = (typeof GOVT_VERIFICATION_LEVEL_KEYS)[number];

export const GOVT_ALIAS_TYPE_KEYS = [
    'patronymic_short',
    'kunya',
    'ocr_variant',
    'english',
    'former_spelling',
] as const;

export type GovtAliasType = (typeof GOVT_ALIAS_TYPE_KEYS)[number];

export const GOVT_DATE_PRECISION_KEYS = [
    'exact',
    'month',
    'year',
    'first_seen',
    'inferred_successor',
] as const;

export type GovtDatePrecision = (typeof GOVT_DATE_PRECISION_KEYS)[number];

export const GOVT_SLOT_STATUS_KEYS = [
    'active',
    'merged',
    'abolished',
] as const;

export type GovtSlotStatus = (typeof GOVT_SLOT_STATUS_KEYS)[number];

export interface GovtTenureItem {
    id: string;
    official_id: string;
    office_slot_id: string | null;
    office_slot_slug: string | null;
    office_slot_title_ar: string | null;
    institution_id: string | null;
    institution_name_ar: string | null;
    role_title_ar: string;
    tier: string;
    government_phase: string;
    status: string;
    started_at: string | null;
    start_date_precision: string;
    start_decree_ref: string | null;
    ended_at: string | null;
    end_date_precision: string | null;
    end_reason: string | null;
    end_decree_ref: string | null;
    first_operational_seen_at: string | null;
    last_operational_seen_at: string | null;
    operational_mentions_count: number;
    is_acting: boolean;
    notes_ar: string | null;
    predecessor: {
        official_slug: string;
        official_name_ar: string;
        ended_at: string | null;
    } | null;
    successor: {
        official_slug: string;
        official_name_ar: string;
        started_at: string | null;
    } | null;
}

export interface GovtCvEntryItem {
    id: string;
    official_id: string;
    section: string;
    title_ar: string;
    organization_ar: string | null;
    location_ar: string | null;
    start_year: number | null;
    end_year: number | null;
    is_ongoing: boolean;
    details_ar: string | null;
    sort_order: number;
}

export interface GovtEvidenceItem {
    id: string;
    official_id: string;
    tenure_id: string | null;
    evidence_type: string;
    paperless_record_id: number | null;
    paperless_channel_id: string | null;
    paperless_message_id: number | null;
    chunk_type: string | null;
    source_title_ar: string;
    source_channel_ar: string | null;
    source_url: string | null;
    published_date: string | null;
    excerpt_ar: string | null;
}

export interface GovtAliasItem {
    id?: string;
    alias_ar: string;
    alias_type: string;
    source_note: string | null;
}

export interface GovtActiveTenure {
    institution_id?: string | null;
    institution_name_ar?: string | null;
    role_title_ar: string;
    tier: string;
    government_phase: string;
    started_at?: string | null;
    start_date_precision?: string;
    ended_at?: string | null;
    end_date_precision?: string | null;
    is_acting?: boolean;
}

export interface GovtOfficialSummary {
    id: string;
    slug: string;
    full_name_ar: string;
    display_name_ar?: string;
    full_name_en?: string | null;
    honorific_ar?: string | null;
    bio_summary_ar?: string | null;
    birth_place_ar?: string | null;
    office_status: string;
    highest_tier: string;
    cv_completeness: string;
    portrait_url?: string | null;
    first_seen_in_office_at?: string | null;
    tenures_count: number;
    active_tenure?: GovtActiveTenure | null;
}

export interface GovtOfficialAdminSummary extends Omit<GovtOfficialSummary, 'active_tenure' | 'bio_summary_ar' | 'birth_place_ar'> {
    display_name_ar: string;
    bio_summary_ar?: string | null;
    birth_year?: number | null;
    birth_place_ar?: string | null;
    gender?: string | null;
    resolved_portrait_url: string | null;
    verification_level: string;
    publish_status: string;
    last_seen_in_office_at: string | null;
    current_tenure: GovtTenureItem | null;
    latest_tenure: GovtTenureItem | null;
    cv_entries_count: number;
    evidence_count: number;
    version: number;
    updated_at: string | null;
}

export interface GovtOfficialEntityLink {
    href: string;
    label: string;
    category?: string;
}

export interface GovtHouseLink {
    href: string;
    label: string;
}

export interface GovtMinistryLink {
    slug: string;
    href: string;
    name_ar: string;
    kind: string;
    status: string;
    is_current: boolean;
    role_title: string;
}

export interface GovtOfficialDetail extends GovtOfficialAdminSummary {
    bio_summary_ar: string | null;
    birth_year: number | null;
    birth_place_ar: string | null;
    gender: string | null;
    languages: string[];
    socials: Record<string, string>;
    candidate_id: string | null;
    promise_speaker_id: string | null;
    official_entity_id: string | null;
    house_member_id: number | null;
    links?: {
        candidate_id?: string | null;
        promise_speaker_id?: string | null;
        official_entity_id?: string | null;
        house_member_id?: number | null;
        tierlist_url?: string | null;
        promises_url?: string | null;
        syofficial_url?: string | null;
        house_url?: string | null;
    };
    official_entity_link?: GovtOfficialEntityLink | null;
    house_link?: GovtHouseLink | null;
    ministry_links?: GovtMinistryLink[];
    aliases: GovtAliasItem[];
    tenures: GovtTenureItem[];
    cv_entries: GovtCvEntryItem[];
    evidence_links: GovtEvidenceItem[];
}

export interface GovtMovementItem {
    tenure_id: string;
    movement_kind: 'appointment' | 'transition' | 'exit';
    date: string | null;
    date_precision: string | null;
    official_slug: string;
    official_name_ar: string;
    official_honorific_ar: string | null;
    official_portrait_url: string | null;
    official_office_status: string;
    role_title_ar: string;
    institution_id: string | null;
    institution_name_ar: string | null;
    tier: string;
    government_phase: string;
    decree_ref: string | null;
    end_reason: string | null;
    predecessor: {
        official_slug: string;
        official_name_ar: string;
    } | null;
    successor: {
        official_slug: string;
        official_name_ar: string;
    } | null;
    source_url: string | null;
}

export interface GovtOfficeSlotItem {
    id: string;
    slug: string;
    title_ar: string;
    institution_id: string | null;
    institution_name_ar: string | null;
    tier: string;
    is_single_seat: boolean;
    status: string;
    active_from: string | null;
    ended_at: string | null;
    lineage_note_ar: string | null;
    replaced_by_slot_id: string | null;
    current_holder: {
        id: string;
        slug: string;
        display_name_ar: string;
    } | null;
    tenures_count: number;
}

export interface GovtCvsStats {
    total: number;
    in_office: number;
    out_of_office: number;
    uncertain: number;
    full_cv: number;
    total_movements: number;
}

export interface InstitutionOption {
    id: string;
    name_ar: string;
    category_id?: string;
}
