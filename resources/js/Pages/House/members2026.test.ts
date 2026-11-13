import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MEMBERS_2026, OMran_SOURCE_URL } from './members2026';

/**
 * The page's bundled roster is generated from the seeder's CSV
 * (`scripts/export-house-members.mjs`). It is the fallback when the table read
 * fails or is empty, and the source of the social links merged into the DB rows
 * by name — so the two datasets have to be the same one.
 *
 * The CSV is parsed here rather than by importing the generator: the generator
 * is a plain ES module for Node, and this test has to run in the same runner as
 * the rest of the frontend. A change to one side without the other fails here.
 */
const CSV = new URL('../../../../database/seeders/data/house_members_2026.csv', import.meta.url);

function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];

        if (quoted) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 1;
                } else {
                    quoted = false;
                }
            } else {
                field += char;
            }
            continue;
        }

        if (char === '"') quoted = true;
        else if (char === ',') {
            row.push(field);
            field = '';
        } else if (char === '\n' || char === '\r') {
            if (char === '\r' && text[i + 1] === '\n') i += 1;
            row.push(field);
            field = '';
            if (row.length > 1 || row[0] !== '') rows.push(row);
            row = [];
        } else {
            field += char;
        }
    }

    if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows;
}

const [header, ...rows] = parseCsv(readFileSync(CSV, 'utf8'));

const COLUMNS = [
    'name_ar', 'governorate_ar', 'district', 'town', 'gender', 'birth_year', 'age',
    'selection_method', 'category', 'status', 'member_number', 'management_position',
    'facebook_url', 'twitter_url',
] as const;

const csvMembers = rows
    .filter((row) => row.length >= header.length)
    .map((row) => Object.fromEntries(COLUMNS.map((column) => [column, row[header.indexOf(column)] ?? ''])));

describe('the bundled House roster is the seeder CSV', () => {
    it('has one row per seeded member, in the same order', () => {
        expect(MEMBERS_2026).toHaveLength(csvMembers.length);
        expect(MEMBERS_2026.map((member) => member.member_number)).toEqual(
            csvMembers.map((member) => member.member_number),
        );
    });

    it('carries the same values as the CSV, member by member', () => {
        expect(MEMBERS_2026).toEqual(csvMembers);
    });

    it('takes the source link from the CSV', () => {
        const sourceUrl = rows.map((row) => row[header.indexOf('source_url')])[0];

        expect(OMran_SOURCE_URL).toBe(encodeURI(sourceUrl));
    });
});
