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
export type CounterMode = 'left' | 'today' | 'overdue' | 'since' | 'early' | 'ontime' | 'late' | 'took' | 'closed';

export interface PromiseCounter {
    mode: CounterMode;
    value: number | null;
}

export interface PromiseCoSpeakerData {
    id: string | null;
    name: string | null;
    title: string | null;
    image: string | null;
    xHandle?: string | null;
}

/** The "will it be kept?" tally. Only aggregates ever leave the server. */
export interface PromiseVotes {
    yes: number;
    no: number;
}

export interface PromiseCardData {
    id: string;
    number: number;
    title: string;
    speaker: { id: string | null; name: string | null; title: string | null; image: string | null };
    coSpeakers?: PromiseCoSpeakerData[];
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
    /** False once an editor has set a verdict. */
    votingOpen: boolean;
    /** Present on the list and the detail page; absent where a card is built without its tally. */
    votes?: PromiseVotes;
    originalDeadlineDate?: string | null;
    originalDeadlineWording?: string | null;
    postponedCount?: number;
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

export type PromiseUpdateType =
    | 'progress'
    | 'status_change'
    | 'official_response'
    | 'note'
    | 'deadline_change';

export interface PromiseUpdateData {
    id: number;
    type: PromiseUpdateType;
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
    speakerName?: string | null;
    statementDate?: string | null;
    deadlineDate?: string | null;
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
    relatedPromises?: RelatedPromise[];
    votes: PromiseVotes;
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
