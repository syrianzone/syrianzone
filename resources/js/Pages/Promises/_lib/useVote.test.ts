import { describe, expect, it } from 'vitest';
import { newestVotes, rememberVotes } from './useVote';

describe('remembered vote tallies', () => {
    it('replaces the props a vote made stale, as when going Back to the list', () => {
        const listProps = { yes: 4, no: 2 };
        rememberVotes(1, { yes: 5, no: 2 }, listProps);

        expect(newestVotes(1, listProps)).toEqual({ yes: 5, no: 2 });
    });

    it('lets fresh props win when another voter changed their answer and the total did not move', () => {
        rememberVotes(2, { yes: 5, no: 2 }, { yes: 4, no: 2 });

        expect(newestVotes(2, { yes: 4, no: 3 })).toEqual({ yes: 4, no: 3 });
    });

    it('still replaces the list props after the answer is changed on the detail page', () => {
        const listProps = { yes: 4, no: 2 };
        const detailProps = { yes: 5, no: 2 };
        rememberVotes(3, detailProps, listProps);
        rememberVotes(3, { yes: 4, no: 3 }, detailProps);

        expect(newestVotes(3, listProps)).toEqual({ yes: 4, no: 3 });
        expect(newestVotes(3, detailProps)).toEqual({ yes: 4, no: 3 });
    });

    it('leaves promises the visitor has not voted on alone', () => {
        expect(newestVotes(4, { yes: 1, no: 1 })).toEqual({ yes: 1, no: 1 });
    });
});
