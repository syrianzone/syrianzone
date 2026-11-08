/** Payload shapes produced by App\Services\Promises\PromisePresenter. */

export type PromiseStatus =
    | 'pending'
    | 'in_progress'
    | 'fulfilled'
    | 'partially_fulfilled'
    | 'broken'
    | 'postponed'
    | 'retracted';

/** The editorial status plus the derived `overdue` state. */
export type PromiseState = PromiseStatus | 'overdue';

export interface SectorOption {
    id: string;
    label: string;
    icon: string | null;
}

export interface Option {
    id: string;
    label: string;
}

export interface PromiseTarget {
    value: number;
    unit: string | null;
    baseline: number | null;
    baselineNote: string | null;
    current: number | null;
    currentOn: string | null;
    percent: number | null;
}

/** What the big number means; see Promise::counter(). */
export type CounterMode = 'left' | 'today' | 'overdue' | 'since' | 'early' | 'ontime' | 'late' | 'took' | 'since_deadline';

export interface PromiseCounter {
    mode: CounterMode;
    value: number | null;
}

export interface PromiseCardData {
    id: string;
    number: number;
    title: string;
    speaker: { id: string | null; name: string | null; title: string | null; image: string | null };
    institution: { id: string; name: string } | null;
    sector: SectorOption | null;
    isNational: boolean;
    governorates: string[];
    tags: string[];
    statementDate: string;
    deadlineDate: string | null;
    deadlineWording: string | null;
    status: PromiseStatus;
    state: PromiseState;
    daysLeft: number | null;
    daysSince: number;
    counter: PromiseCounter;
    keptLate: boolean;
    resolvedAt: string | null;
    target: PromiseTarget | null;
}

export interface PromiseSourceData {
    id: number;
    url: string;
    outlet: string | null;
    type: string;
    publishedDate: string | null;
    language: string | null;
    archiveUrl: string | null;
    screenshotUrl: string | null;
    videoTimestamp: string | null;
    isPrimary: boolean;
}

export interface PromiseUpdateData {
    id: number;
    type: 'progress' | 'status_change' | 'official_response' | 'note';
    happenedOn: string;
    body: string | null;
    statusFrom: PromiseStatus | null;
    statusTo: PromiseStatus | null;
    value: number | null;
    sourceUrl: string | null;
    archiveUrl: string | null;
}

export interface RelatedPromise {
    number: number;
    title: string;
    state: PromiseState;
}

export interface PromiseDetailData extends PromiseCardData {
    summary: string | null;
    quote: string;
    quoteIsVerbatim: boolean;
    statementVenue: string;
    deadlineReasoning: string | null;
    /** Arabic labels for `governorates`, from App\Support\Governorates. */
    governorateNames: string[];
    speakerXHandle: string | null;
    sources: PromiseSourceData[];
    updates: PromiseUpdateData[];
    restates: RelatedPromise | null;
    restatedBy: RelatedPromise | null;
    votes: { yes: number; no: number };
    votingOpen: boolean;
    publishedAt: string | null;
    updatedAt: string | null;
}

export interface PromiseStats {
    total: number;
    fulfilled: number;
    keptLate: number;
    partiallyFulfilled: number;
    broken: number;
    overdue: number;
    open: number;
    postponed: number;
    retracted: number;
}

/** One option in the speaker picker (see App\Services\Promises\SpeakerDirectory). */
export interface SpeakerOption {
    ref: string;
    name: string;
    title: string | null;
    image: string | null;
    source: 'speaker' | 'candidate' | 'official' | 'house';
    pending: boolean;
}
