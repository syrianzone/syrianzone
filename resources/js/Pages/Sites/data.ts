import { Website, CSV_URL } from './types';

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

function parseCSVToObjects(csvText: string): Website[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = parseCSVRow(lines[0]).map(h => h.trim());
    const data: Website[] = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = parseCSVRow(lines[i]);
        const row: any = {};

        headers.forEach((header, index) => {
            if (index < values.length) {
                row[header] = values[index];
            }
        });

        // Mapping from CSV headers to interface
        const url = row['رابط الموقع'];
        const name = row['اسم الموقع'];

        if (!url || !name) continue;

        data.push({
            id: `site-${i}`,
            name: name,
            url: url,
            type: row['نوع الموقع'] || '',
            description: row['توصيف الموقع'] || ''
        });
    }

    return data;
}

export async function fetchWebsites(): Promise<Website[]> {
    try {
        const res = await fetch(CSV_URL, { next: { revalidate: 3600 } });
        if (!res.ok) throw new Error('Failed to fetch data');
        const text = await res.text();
        return parseCSVToObjects(text);
    } catch (error) {
        console.error('Error fetching websites:', error);
        return [];
    }
}
