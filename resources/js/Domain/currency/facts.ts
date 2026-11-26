import rawFacts from '../../../data/currency.json';

export interface CurrencySource {
    label_ar: string;
    url: string;
}

export interface CurrencyImage {
    path: string;
    width: number;
    height: number;
    alt: string;
    source_url: string;
    credit_ar: string;
}

export interface NewDenomination {
    value: number;
    old_equivalent: number;
    type: 'note' | 'coin';
    type_ar: string;
    name_ar: string;
    color_ar: string;
    motifs_ar: string;
    back_ar: string;
    source_url: string;
    front_image: CurrencyImage;
    back_image: CurrencyImage | null;
}

export interface OldDenomination {
    value: number;
    new_equivalent: number;
    type: 'note' | 'coin';
    type_ar: string;
    name_ar: string;
    color_ar: string;
    motifs_ar: string;
    withdrawal_phase_ar: string;
    status_ar: string;
    source_url: string;
    front_image: CurrencyImage;
    back_image: CurrencyImage | null;
}

export interface CurrencyTimelineItem {
    date: string;
    date_label_ar: string;
    title_ar: string;
    detail_ar: string;
    source_url: string;
    source_label_ar: string;
}

export interface CurrencyFaqItem {
    id: string;
    question_ar: string;
    answer_ar: string;
    source_url: string;
}

export interface CurrencyFacts {
    meta: {
        title_ar: string;
        as_of: string;
        sources: CurrencySource[];
    };
    ratio: {
        old_per_new: number;
        zeros_removed: number;
        subunit_ar: string;
        subunits_per_new: number;
        legal_decree_ar: string;
        summary_ar: string;
        source_url: string;
    };
    legal_status: {
        old_legal_tender: boolean;
        old_legal_tender_ended_on: string;
        old_invalid_from: string;
        headline_ar: string;
        summary_ar: string;
        source_url: string;
    };
    denominations_note_ar: string;
    denominations_note_source_url: string;
    common_amounts_old: number[];
    new_denominations: NewDenomination[];
    old_denominations: OldDenomination[];
    timeline: CurrencyTimelineItem[];
    exchange_info: {
        title_ar: string;
        portal_url: string;
        portal_label_ar: string;
        window_years: number;
        window_start: string;
        fees_ar: string;
        summary_ar: string;
        rules_ar: string[];
        source_url: string;
    };
    faq: CurrencyFaqItem[];
}

export const CURRENCY_FACTS = rawFacts as CurrencyFacts;

/** Issued new SYP banknote values derived from the shared facts file. */
export const NEW_NOTE_VALUES: readonly number[] = CURRENCY_FACTS.new_denominations
    .map((d) => d.value)
    .sort((a, b) => a - b);

export const OLD_PER_NEW_RATIO = CURRENCY_FACTS.ratio.old_per_new;
