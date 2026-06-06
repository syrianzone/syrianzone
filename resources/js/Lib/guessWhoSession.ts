const getTabId = (): string => {
  if (typeof window === 'undefined') return '';
  let tabId = window.name;
  if (!tabId || !tabId.startsWith('guess_who_tab_')) {
    // Generate fallback or random UUID if crypto isn't available
    const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    tabId = 'guess_who_tab_' + uuid;
    window.name = tabId;
  }
  return tabId;
};

export const getGuessWhoSessionId = (): string => {
  if (typeof window === 'undefined') return '';
  const tabId = getTabId();
  const storageKey = `guess_who_session_id_${tabId}`;
  let sessionId = sessionStorage.getItem(storageKey);
  if (!sessionId) {
    sessionId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem(storageKey, sessionId);
  }
  return sessionId;
};
