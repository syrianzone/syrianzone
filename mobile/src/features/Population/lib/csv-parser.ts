export function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let index = 0;

  while (index < line.length) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 2;
      } else {
        inQuotes = !inQuotes;
        index += 1;
      }
    } else if (character === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      index += 1;
    } else {
      current += character ?? '';
      index += 1;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCSVToObjects(
  csvText: string,
): readonly Record<string, string>[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2 || !lines[0]) {
    return [];
  }

  const headers = parseCSVRow(lines[0]).map((header) => header.trim());
  const data: Record<string, string>[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) {
      continue;
    }
    const values = parseCSVRow(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      const value = values[index];
      if (value !== undefined) {
        row[header] = value;
      }
    });
    data.push(row);
  }
  return data;
}

/*
PORT STATUS
  source:     resources/js/Pages/Population/lib/csv-parser.ts (52 lines)
  confidence: high
  todos:      0
  notes:      Quoted fields and escaped quotes retain source behavior without loose any values.
*/
