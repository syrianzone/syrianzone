(function () {
	// Global namespace
	window.SZ = window.SZ || {};

	// CSV utilities
	const csv = {
		// Split text into lines handling CRLF/CR and trim BOM
		splitLines(text) {
			if (!text || typeof text !== 'string') return [];
			const cleaned = csv.trimBOM(text).replace(/\r\n?|\n/g, '\n');
			return cleaned.split('\n');
		},

		// Remove UTF-8 BOM if present
		trimBOM(text) {
			if (text && text.charCodeAt(0) === 0xFEFF) {
				return text.slice(1);
			}
			return text;
		},

		// Parse a single CSV line into fields, supporting quoted fields and escaped quotes
		parseCSVLine(line, delimiter = ',') {
			const result = [];
			let current = '';
			let inQuotes = false;
			for (let i = 0; i < line.length; i++) {
				const char = line[i];
				if (char === '"') {
					if (inQuotes && line[i + 1] === '"') {
						current += '"';
						i++;
					} else {
						inQuotes = !inQuotes;
					}
				} else if (char === delimiter && !inQuotes) {
					result.push(current);
					current = '';
				} else {
					current += char;
				}
			}
			result.push(current);
			return result;
		},

		// Detect when a supposed CSV response actually contains an HTML redirect/page
		detectRedirectHTML(text) {
			if (!text) return false;
			const trimmed = text.trim().slice(0, 200).toLowerCase();
			return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html') || trimmed.includes('<title>');
		},

		// Parse CSV string into an array of arrays
		parseCSV(text, delimiter = ',') {
			const lines = csv.splitLines(text);
			const rows = [];
			for (let i = 0; i < lines.length; i++) {
				const raw = lines[i];
				if (!raw || raw.trim() === '') continue;
				rows.push(csv.parseCSVLine(raw, delimiter));
			}
			return rows;
		},

		// Parse CSV string into an array of objects using the header row
		parseCSVToObjects(text, options = {}) {
			const { delimiter = ',', trimHeaders = true } = options;
			const rows = csv.parseCSV(text, delimiter);
			if (rows.length < 2) return [];
			let headers = rows[0].map(h => (trimHeaders ? (h || '').trim() : (h || '')));
			const data = [];
			for (let i = 1; i < rows.length; i++) {
				const row = rows[i];
				if (!row || row.length === 0) continue;
				const obj = {};
				for (let j = 0; j < headers.length; j++) {
					const key = headers[j] || `col_${j}`;
					obj[key] = (row[j] ?? '').toString().trim();
				}
				data.push(obj);
			}
			return data;
		}
	};

	window.SZ.csv = csv;
})();
