import { Organization, COLUMNS, CSV_URL } from './types';

// Helper to parse CSV line handling quotes
function parseCSVRow(line: string): string[] {
    const result = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i += 2;
            } else {
                inQuotes = !inQuotes;
                i++;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
            i++;
        } else {
            current += char;
            i++;
        }
    }
    result.push(current.trim());
    return result;
}

function parseCSVToObjects(csvText: string): Organization[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim());
    const data: Organization[] = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = parseCSVRow(lines[i]);
        const row: any = {};

        headers.forEach((header, index) => {
            if (index < values.length) {
                row[header] = values[index];
            }
        });

        const name = row[COLUMNS.INITIATIVE_NAME];
        if (!name) continue;

        const politicalLeanings = row[COLUMNS.POLITICAL_LEANINGS]
            ? row[COLUMNS.POLITICAL_LEANINGS].split('|').map((s: string) => s.trim()).filter(Boolean)
            : [];

        const city = row[COLUMNS.CITY];
        const country = row[COLUMNS.COUNTRY];
        const formattedLocation = [city, country].filter(Boolean).join(', ');

        data.push({
            id: `org-${i}`,
            name: name,
            description: row[COLUMNS.DESCRIPTION],
            type: row[COLUMNS.CATEGORY],
            country: country,
            city: city,
            formattedLocation,
            socialX: row[COLUMNS.X_ACCOUNT],
            socialInsta: row[COLUMNS.INSTAGRAM_ACCOUNT],
            socialFb: row[COLUMNS.FACEBOOK_ACCOUNT],
            website: row[COLUMNS.WEBSITE],
            manifesto: row[COLUMNS.MANIFESTO_LINK],
            email: row[COLUMNS.EMAIL],
            phone: row[COLUMNS.PHONE],
            lang: row[COLUMNS.LANG],
            politicalLeanings,
            mvpMembers: row[COLUMNS.MVP_MEMBERS],
            youtube: row['social - youtube'], // Helper expectation
            telegram: row['social - telegram'] // Helper expectation
        });
    }

    return data;
}

export async function fetchOrganizations(): Promise<Organization[]> {
    try {
        const res = await fetch(CSV_URL, { next: { revalidate: 3600 } }); // Revalidate every hour
        if (!res.ok) throw new Error('Failed to fetch data');
        const text = await res.text();
        return parseCSVToObjects(text);
    } catch (error) {
        console.error('Error fetching organizations:', error);
        return [];
    }
}

// Helper for social links formatting
export function formatSocialUrl(platform: 'x' | 'instagram' | 'facebook' | 'youtube' | 'telegram', handle: string): string {
    if (!handle) return '';
    if (handle.startsWith('http')) return handle;

    const cleanHandle = handle.replace(/^@/, '');

    switch (platform) {
        case 'x': return `https://x.com/${cleanHandle}`;
        case 'instagram': return `https://instagram.com/${cleanHandle}`;
        case 'facebook': return `https://facebook.com/${cleanHandle}`;
        case 'youtube': return `https://youtube.com/${cleanHandle}`;
        case 'telegram': return `https://t.me/${cleanHandle}`;
        default: return handle;
    }
}

export function getLanguageName(code: string): string {
    const map: { [key: string]: string } = {
        'AR': 'العربية',
        'EN': 'English',
        'KU': 'Kurdish',
        'TR': 'Turkish'
    };
    return map[code] || code;
}
