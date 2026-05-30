(function () {
	window.SZ = window.SZ || {};

	/**
	 * LocalStorage TTL cache with namespacing
	 */
	function createCache(namespace) {
		const ns = namespace || 'sz';
		const makeKey = (key) => `${ns}:${key}`;

		function set(key, value, ttlMs) {
			try {
				const expiresAt = typeof ttlMs === 'number' ? Date.now() + ttlMs : null;
				const payload = { v: value, e: expiresAt };
				localStorage.setItem(makeKey(key), JSON.stringify(payload));
				return true;
			} catch (_) { return false; }
		}

		function get(key) {
			try {
				const raw = localStorage.getItem(makeKey(key));
				if (!raw) return null;
				const payload = JSON.parse(raw);
				if (payload && typeof payload === 'object') {
					if (payload.e && Date.now() > payload.e) {
						localStorage.removeItem(makeKey(key));
						return null;
					}
					return payload.v;
				}
				return null;
			} catch (_) { return null; }
		}

		function remove(key) {
			try { localStorage.removeItem(makeKey(key)); } catch (_) {}
		}

		function clearAll() {
			try {
				const prefix = `${ns}:`;
				for (let i = localStorage.length - 1; i >= 0; i--) {
					const k = localStorage.key(i);
					if (k && k.startsWith(prefix)) localStorage.removeItem(k);
				}
			} catch (_) {}
		}

		return { set, get, remove, clearAll };
	}

	window.SZ.cache = { createCache };
})();
