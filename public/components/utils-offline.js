(function () {
	window.SZ = window.SZ || {};

	function createBanner() {
		const id = 'sz-offline-banner';
		if (document.getElementById(id)) return document.getElementById(id);
		const el = document.createElement('div');
		el.id = id;
		el.style.cssText = [
			'position:fixed','left:0','right:0','top:0','z-index:9999','display:none',
			'background: #A73F46','color:#fff','padding:8px 12px','text-align:center',
			'font-family: "IBM Plex Sans Arabic", sans-serif','box-shadow:0 2px 6px rgba(0,0,0,.2)'
		].join(';');
		el.innerHTML = 'لا يوجد اتصال بالإنترنت. سيتم إعادة المحاولة بالخلفية.';
		document.body.appendChild(el);
		return el;
	}

	function showBanner() {
		const el = createBanner();
		el.style.display = 'block';
	}
	function hideBanner() {
		const el = createBanner();
		el.style.display = 'none';
	}

	/**
	 * Run an async loader with offline handling: show banner when navigator is offline or loader fails due to network,
	 * retry in background with backoff, and hide banner when success.
	 * @param {() => Promise<any>} loader async function to run
	 * @param {{ retries?: number, backoffMs?: number, factor?: number, onSuccess?: (data:any)=>void, onError?: (err:Error)=>void }} options
	 */
	async function runWithOfflineRetry(loader, options = {}) {
		const { retries = 5, backoffMs = 2000, factor = 1.8, onSuccess, onError } = options;
		let attempt = 0;
		const sleep = (ms) => new Promise(r => setTimeout(r, ms));

		if (!navigator.onLine) showBanner();

		while (attempt < retries) {
			try {
				const data = await loader();
				hideBanner();
				onSuccess && onSuccess(data);
				return data;
			} catch (err) {
				attempt++;
				showBanner();
				if (attempt >= retries) {
					onError && onError(err);
					throw err;
				}
				// progressive backoff
				await sleep(backoffMs * Math.pow(factor, attempt - 1));
			}
		}
	}

	window.SZ.offline = { runWithOfflineRetry, showBanner, hideBanner };
})();
