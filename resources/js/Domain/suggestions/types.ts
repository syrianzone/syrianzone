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
