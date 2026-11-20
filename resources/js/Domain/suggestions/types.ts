export type SuggestionModule = 'govtcvs' | 'syofficial' | 'govapps' | 'phonebook';

export type SuggestionKind = 'add' | 'edit';

export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed';

export interface SuggestionTargetOption {
    id: string;
    label: string;
    subtitle?: string | null;
}

export interface SuggestionCategoryOption {
    id: string;
    label: string;
}

export interface DirectorySuggestionPayload {
    role_title_ar?: string;
    institution_name_ar?: string;
    decree_ref?: string;
    category_id?: string;
    name_en?: string;
    account_url?: string;
    official_url?: string;
    android_url?: string;
    apple_url?: string;
    number?: string;
    is_whatsapp?: boolean;
}

export interface DirectorySuggestionInput {
    kind: SuggestionKind;
    target_id?: string | null;
    title?: string | null;
    details: string;
    source_url?: string | null;
    payload?: DirectorySuggestionPayload;
}

export interface DirectorySuggestionItem {
    id: number;
    module: SuggestionModule;
    kind: SuggestionKind;
    target_id: string | null;
    target_label: string | null;
    target_edit_url: string | null;
    title: string;
    payload: DirectorySuggestionPayload;
    details: string;
    source_url: string | null;
    status: SuggestionStatus;
    submitter_name: string;
    reviewer_name: string | null;
    reviewed_at: string | null;
    resolution_note: string | null;
    created_at: string | null;
}

export interface DirectorySuggestionCounts {
    pending: number;
    accepted: number;
    dismissed: number;
    total: number;
}

export interface DirectorySuggestionListResponse {
    suggestions: DirectorySuggestionItem[];
    counts: DirectorySuggestionCounts;
}

export type IncomingSectionId =
    | 'govtcvs'
    | 'syofficial'
    | 'govapps'
    | 'phonebook'
    | 'promises'
    | 'places'
    | 'transit';

export type IncomingItemType =
    | 'directory_add'
    | 'directory_edit'
    | 'promise_suggestion'
    | 'promise_speaker'
    | 'promise_report_progress'
    | 'promise_report_error'
    | 'place_submission'
    | 'place_report'
    | 'transit_new_route'
    | 'transit_route_edit';

export interface IncomingSectionSummary {
    id: IncomingSectionId;
    label: string;
    admin_url: string;
    pending_count: number;
    breakdown: Array<{ label: string; count: number }>;
}

export interface IncomingSuggestionItem {
    uid: string;
    section: IncomingSectionId;
    item_type: IncomingItemType;
    record_id: string | number;
    title: string;
    subtitle: string | null;
    details: string | null;
    payload: Record<string, string | number | boolean | null | undefined>;
    source_url: string | null;
    submitter_name: string;
    created_at: string | null;
    section_admin_url: string;
    item_admin_url: string | null;
    action_meta: Record<string, string | number | boolean | null | undefined>;
}

export interface IncomingSuggestionsOverview {
    total_pending: number;
    sections: IncomingSectionSummary[];
    items: IncomingSuggestionItem[];
    generated_at: string;
}
