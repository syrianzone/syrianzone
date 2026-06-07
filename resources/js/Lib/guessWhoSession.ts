const inMemoryCache: Record<string, string> = {};

const getTabId = (): string => {
  if (typeof window === 'undefined') return '';
  let tabId = '';
  try {
    tabId = window.name;
  } catch (e) {
    // window.name might throw in some iframe/cross-origin or private contexts
  }
  if (!tabId || !tabId.startsWith('guess_who_tab_')) {
    // Generate fallback or random UUID if crypto isn't available
    const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    tabId = 'guess_who_tab_' + uuid;
    try {
      window.name = tabId;
    } catch (e) {
      // Ignore errors when setting window.name
    }
  }
  return tabId;
};

export const getGuessWhoSessionId = (): string => {
  if (typeof window === 'undefined') return '';
  const tabId = getTabId();
  const storageKey = `guess_who_session_id_${tabId}`;
  let sessionId: string | null = null;
  try {
    sessionId = sessionStorage.getItem(storageKey);
  } catch (e) {
    // sessionStorage is disabled or throws a SecurityError
    sessionId = inMemoryCache[storageKey] || null;
  }

  if (!sessionId) {
    sessionId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    try {
      sessionStorage.setItem(storageKey, sessionId);
    } catch (e) {
      inMemoryCache[storageKey] = sessionId;
    }
  }
  return sessionId;
};
