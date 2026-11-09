import type { PromiseSourceData, PromiseState, PromiseStatus, PromiseUpdateData, SectorOption, SpeakerOption } from '@/Pages/Promises/_lib/types';

/** Shapes produced by PromisePresenter::adminRow / adminDetail. */

export type ReviewStatus = 'pending' | 'published' | 'rejected';

export interface AdminPromiseRow {
    id: string;
    number: number | null;
    title: string;
    speakerName: string | null;
    speakerPending: boolean;
    status: PromiseStatus;
    state: PromiseState;
    reviewStatus: ReviewStatus;
    origin: 'editor' | 'public' | 'research';
    statementDate: string | null;
    deadlineDate: string | null;
    sourcesCount: number;
    pendingReportsCount: number;
    submitterName: string | null;
    submitterNote: string | null;
    rejectionReason: string | null;
    updatedAt: string | null;
}

export interface AdminPromiseDetail {
    id: string;
    number: number | null;
    title: string;
    summary: string | null;
    quote: string;
    quoteIsVerbatim: boolean;
    speaker: SpeakerOption | null;
    speakerTitle: string | null;
    institutionId: string | null;
    sectorId: string | null;
    isNational: boolean;
    governorates: string[];
    tags: string[];
    statementDate: string | null;
    statementVenue: string;
    deadlineWording: string | null;
    deadlineDate: string | null;
    deadlineReasoning: string | null;
    targetValue: number | null;
    targetUnit: string | null;
    baselineValue: number | null;
    baselineNote: string | null;
    restatesPromiseId: string | null;
    restates: { id: string; number: number | null; title: string } | null;
    status: PromiseStatus;
    state: PromiseState;
    resolvedAt: string | null;
    reviewStatus: ReviewStatus;
    /** Set the first time the promise goes public; from then on its verdicts are permanent. */
    publishedAt: string | null;
    origin: string;
    submitterName: string | null;
    submitterNote: string | null;
    rejectionReason: string | null;
    sources: PromiseSourceData[];
    updates: PromiseUpdateData[];
    /** Sent back on save, which is refused if someone saved the promise since. */
    version: number;
}

export interface EditorOptions {
    sectors: SectorOption[];
    governorates: Array<{ id: string; label: string }>;
    institutions: Array<{ id: string; name: string }>;
    venues: string[];
    sourceTypes: string[];
    statuses: PromiseStatus[];
    earliestDate: string;
    today: string;
    restatable: Array<{ id: string; number: number; title: string }>;
}

export interface AdminSpeaker {
    id: string;
    name: string;
    title: string | null;
    image: string | null;
    xHandle: string | null;
    imageUrl: string | null;
    institutionId: string | null;
    institutionName: string | null;
    status: 'approved' | 'pending' | 'rejected';
    link: 'candidate' | 'official' | 'house' | null;
    promisesCount: number;
    rejectionReason: string | null;
}

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
    pending: 'بانتظار المراجعة',
    published: 'منشور',
    rejected: 'مرفوض',
};

export const ORIGIN_LABEL: Record<string, string> = {
    editor: 'محرر',
    public: 'اقتراح عام',
    research: 'بحث أولي',
};
