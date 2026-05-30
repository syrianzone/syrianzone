(function () {
	window.SZ = window.SZ || {};

	const sleep = (ms) => new Promise(r => setTimeout(r, ms));

	/**
	 * Fetch with retry, exponential backoff, and redirect-to-HTML detection.
	 * @param {string} url
	 * @param {object} options { method, headers, body, retries, backoffMs, factor, timeoutMs, acceptTypes }
	 * @returns {Promise<{ ok: boolean, status: number, text: string }>} response text wrapper
	 */
	async function fetchWithRetry(url, options = {}) {
		const {
			retries = 3,
			backoffMs = 1000,
			factor = 2,
			timeoutMs = 15000,
			acceptTypes = 'text/csv, text/plain, */*',
			method = 'GET',
			headers = {},
			body
		} = options;

		let lastError;
		for (let attempt = 1; attempt <= retries; attempt++) {
			try {
				const controller = new AbortController();
				const id = setTimeout(() => controller.abort(), timeoutMs);
				const response = await fetch(url, {
					method,
					headers: { 'Accept': acceptTypes, 'Cache-Control': 'no-cache', ...headers },
					body,
					redirect: 'follow',
					signal: controller.signal
				});
				clearTimeout(id);

				const text = await response.text();
				if (!response.ok) {
					throw new Error(`HTTP error ${response.status}`);
				}

				// Detect HTML redirects disguised as CSV/text
				if (window.SZ?.csv?.detectRedirectHTML && window.SZ.csv.detectRedirectHTML(text)) {
					throw new Error('Received HTML instead of expected text response');
				}

				return { ok: true, status: response.status, text };
			} catch (error) {
				lastError = error;
				if (attempt < retries) {
					await sleep(backoffMs * Math.pow(factor, attempt - 1));
					continue;
				}
			}
		}

		return Promise.reject(lastError || new Error('fetchWithRetry failed'));
	}

	window.SZ.http = { fetchWithRetry };
})();
