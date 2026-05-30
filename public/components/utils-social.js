(function () {
	window.SZ = window.SZ || {};

	const BASE = {
		x: 'https://x.com/',
		twitter: 'https://x.com/',
		instagram: 'https://instagram.com/',
		facebook: 'https://facebook.com/'
	};

	const LABEL = {
		x: 'X (تويتر)',
		twitter: 'X (تويتر)',
		instagram: 'إنستغرام',
		facebook: 'فيسبوك'
	};

	function sanitizeHandle(value) {
		if (!value) return '';
		let v = String(value).trim();
		if (v.startsWith('@')) v = v.slice(1);
		return v;
	}

	function detectPlatform(columnOrName) {
		const key = (columnOrName || '').toString().toLowerCase();
		if (key.includes('x') || key.includes('twitter')) return 'x';
		if (key.includes('insta')) return 'instagram';
		if (key.includes('fb') || key.includes('face')) return 'facebook';
		return '';
	}

	function format(platformOrColumn, value) {
		const platform = detectPlatform(platformOrColumn) || platformOrColumn;
		const clean = sanitizeHandle(value);
		if (!clean) return '';
		if (/^https?:\/\//i.test(clean)) return clean; // already URL
		const base = BASE[platform] || '';
		return base ? base + clean : clean;
	}

	function label(platformOrColumn) {
		const platform = detectPlatform(platformOrColumn) || platformOrColumn;
		return LABEL[platform] || 'رابط خارجي';
	}

	window.SZ.social = { format, label, sanitizeHandle };
})();
