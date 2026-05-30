import { GovApp, CSV_URL } from './types';
import fs from 'fs';
import path from 'path';

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

function parseCSVToApps(csvText: string): GovApp[] {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = parseCSVRow(lines[0]).map(h => h.trim().toLowerCase());
    const data: GovApp[] = [];

    const publicDir = path.join(process.cwd(), 'public');

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVRow(line);
        const row: any = {};

        headers.forEach((header, index) => {
            if (index < values.length) {
                row[header] = values[index];
            }
        });

        // Use the ID column, or name if ID is missing
        const id = (row['id'] || row['ID'] || row['name'] || `app-${i}`).toLowerCase().trim();
        if (!id) continue;

        // Auto-detect icon and images from public folder
        // Icon should be at /public/assets/apps/{id}/{id}icon.png
        const iconPath = `/assets/apps/${id}/${id}icon.png`;
        const iconExists = fs.existsSync(path.join(publicDir, iconPath));

        // Look for screenshots (id1.png, id2.png, etc.)
        const images: string[] = [];
        for (let n = 1; n <= 10; n++) {
            const imgPath = `/assets/apps/${id}/${id}${n}.png`;
            if (fs.existsSync(path.join(publicDir, imgPath))) {
                images.push(imgPath);
            }
        }

        data.push({
            id: id,
            name: row['name'] || id,
            description: row['description'] || '',
            icon: iconExists ? iconPath : '',
            images: images,
            links: {
                official: row['official site'] || undefined,
                android: row['android download'] || undefined,
                apple: row['apple download'] || undefined
            }
        });
    }

    return data;
}

export async function fetchGovApps(): Promise<GovApp[]> {
    try {
        const res = await fetch(CSV_URL, { next: { revalidate: 3600 } });
        if (!res.ok) throw new Error('Failed to fetch data');
        const text = await res.text();
        return parseCSVToApps(text);
    } catch (error) {
        console.error('Error fetching government apps:', error);
        return [];
    }
}
