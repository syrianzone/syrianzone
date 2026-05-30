import { HouseRow, PROVINCES, CANDIDATES_SHEET, WINNERS_SHEET, Mode } from './types';

function csvUrlFor(sheet: { sheetId: string, gid: string }) {
    return `https://docs.google.com/spreadsheets/d/${sheet.sheetId}/export?format=csv&gid=${sheet.gid}`;
}

function parseNumeric(value: any): number {
    if (typeof value === 'number') return value;
    const str = String(value || '');
    const m = str.match(/-?\d+(?:[\.,]\d+)?/);
    if (!m) return 0;
    return Number(m[0].replace(',', '.')) || 0;
}

function stripArabicDiacritics(str: string): string {
    return (str || '').replace(/[\u064B-\u0652\u0670\u0640]/g, '');
}

function normalizeString(str: string): string {
    let s = String(str || '');
    s = stripArabicDiacritics(s);
    s = s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
    s = s.toLowerCase().trim();
    return s;
}

function normalizeSex(value: string): string {
    const v = normalizeString(value);
    if (v === 'ذكر') return 'ذكر';
    if (v === 'انثى' || v === 'انثي') return 'أنثى';
    return '';
}

function computeAge(row: any): number {
    const ageRaw = row['Age'] || row['العمر'] || row['السن'];
    let ageNum = parseNumeric(ageRaw);
    if (!ageNum || ageNum < 0 || ageNum > 120) {
        const by = parseNumeric(row['BirthYear'] || row['سنة الميلاد'] || row['سنة_الميلاد']);
        if (by > 1900 && by < 2100) {
            const nowYear = new Date().getFullYear();
            ageNum = Math.max(0, Math.min(120, nowYear - Math.round(by)));
        }
    }
    return ageNum;
}

function ageToGroup(age: number): string {
    if (age < 30) return 'lt30';
    if (age < 40) return '30s';
    if (age < 50) return '40s';
    if (age < 60) return '50s';
    return '60p';
}

// Simple CSV Parser
function parseCSVRow(line: string): string[] {
    const result: string[] = [];
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

function parseCSVToObjects(csvText: string): HouseRow[] {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = parseCSVRow(lines[0]);
    const normalizedHeaders = headers.map(h => h.trim());

    const data: HouseRow[] = [];
    // Only map known appeal column names
    const appealKeys = ['حالة الطعن', 'AppealStatus'];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVRow(lines[i]);
        if (values.length < 2) continue;

        const obj: any = {};
        normalizedHeaders.forEach((header, index) => {
            obj[header] = index < values.length ? values[index] : '';
        });

        const appealKey = appealKeys.find(k => obj[k]) || '';

        // Compute derived fields
        const sexNorm = normalizeSex(obj['Sex'] || obj['الجنس']);
        const ageNum = computeAge(obj);

        const row: HouseRow = {
            ...obj,
            __nameNorm: normalizeString(obj['Name'] || obj['الاسم']),
            __placeNorm: normalizeString(obj['Place'] || obj['المكان']),
            __sexNorm: sexNorm,
            __ageGroup: ageToGroup(ageNum),
            __appealStatus: String(obj[appealKey] || '').trim(),
            'Age': String(ageNum) // Normalize Age field
        };

        // Filter empty rows
        if (!row.__nameNorm && !row.__placeNorm) continue;

        data.push(row);
    }

    return data;
}

export async function fetchHouseData(mode: Mode, provinceKey: string = 'damascus'): Promise<{ rows: HouseRow[], headers: string[] }> {
    try {
        let url;
        if (mode === 'winners') {
            url = csvUrlFor(WINNERS_SHEET);
        } else if (mode === 'candidates') {
            url = csvUrlFor(CANDIDATES_SHEET);
        } else {
            const province = PROVINCES.find(p => p.key === provinceKey) || PROVINCES[4]; // Default to Damascus
            url = csvUrlFor(province);
        }

        const res = await fetch(url, { next: { revalidate: 3600 } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();
        if (text.includes('<!DOCTYPE html>')) {
            // Handle redirect/error HTML response
            console.error('Received HTML instead of CSV');
            return { rows: [], headers: [] };
        }

        const rows = parseCSVToObjects(text);
        const headers = rows.length > 0
            ? Object.keys(rows[0]).filter(k => !k.startsWith('__'))
            : [];

        return { rows, headers };
    } catch (error) {
        console.error('Error fetching house data:', error);
        return { rows: [], headers: [] };
    }
}
