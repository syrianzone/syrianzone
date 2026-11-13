import { describe, expect, it } from 'vitest';
import { ORIGIN_LABEL, REVIEW_STATUS_LABEL, SOURCE_TYPE_LABEL, VENUE_LABEL } from './status';
import {
    PROMISE_ORIGIN_KEYS,
    PROMISE_REVIEW_STATUS_KEYS,
    PROMISE_SOURCE_TYPE_KEYS,
    PROMISE_VENUE_KEYS,
} from './types';

// The maps are built from resources/data/promises.json behind a check that
// throws when a key has no label, so importing the module already fails on a
// half-edited vocabulary. These assertions pin which list is which.
describe('promise vocabulary from resources/data/promises.json', () => {
    it('labels every venue, source type, review status and origin', () => {
        expect(Object.keys(VENUE_LABEL).sort()).toEqual([...PROMISE_VENUE_KEYS].sort());
        expect(Object.keys(SOURCE_TYPE_LABEL).sort()).toEqual([...PROMISE_SOURCE_TYPE_KEYS].sort());
        expect(Object.keys(REVIEW_STATUS_LABEL).sort()).toEqual([...PROMISE_REVIEW_STATUS_KEYS].sort());
        expect(Object.keys(ORIGIN_LABEL).sort()).toEqual([...PROMISE_ORIGIN_KEYS].sort());
    });

    it('keeps the two source vocabularies distinct', () => {
        // A statement can be a speech or a newspaper interview; a cited source
        // can be a news article or a video. One list for both would mislabel one.
        expect(PROMISE_VENUE_KEYS).toContain('speech');
        expect(PROMISE_SOURCE_TYPE_KEYS).toContain('news_article');

        expect(VENUE_LABEL.speech).toBe('خطاب');
        expect(SOURCE_TYPE_LABEL.video).toBe('فيديو');
        expect(REVIEW_STATUS_LABEL.pending).toBe('بانتظار المراجعة');
        expect(ORIGIN_LABEL.public).toBe('اقتراح عام');
    });
});
