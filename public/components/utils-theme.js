(function(){
    const THEME_KEY = 'sz-theme';
    const STARTPAGE_KEY = 'startpage-settings';
    const THEMES = ['light','dark','dark-blue','dark-purple','dark-green','high-contrast'];

    function readStartpageTheme() {
        try {
            const raw = localStorage.getItem(STARTPAGE_KEY);
            if (!raw) return null;
            const settings = JSON.parse(raw);
            return settings?.theme || null;
        } catch { return null; }
    }

    function writeStartpageTheme(theme) {
        try {
            const raw = localStorage.getItem(STARTPAGE_KEY);
            const settings = raw ? JSON.parse(raw) : {};
            const merged = { ...settings, theme };
            localStorage.setItem(STARTPAGE_KEY, JSON.stringify(merged));
        } catch {}
    }

    function getStoredTheme() {
        const direct = localStorage.getItem(THEME_KEY);
        if (direct) return direct;
        const fromStartpage = readStartpageTheme();
        return fromStartpage || 'dark';
    }

    function applyTheme(theme) {
        if (!THEMES.includes(theme)) theme = 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        // Update shadow-rooted consumers via CSS vars already defined in /styles/theme.css
    }

    function setTheme(theme) {
        if (!THEMES.includes(theme)) return;
        localStorage.setItem(THEME_KEY, theme);
        writeStartpageTheme(theme);
        applyTheme(theme);
    }

    function cycleTheme() {
        const current = get();
        const idx = THEMES.indexOf(current);
        const next = THEMES[(idx + 1) % THEMES.length];
        setTheme(next);
        return next;
    }

    function get() { return getStoredTheme(); }

    function init() {
        applyTheme(getStoredTheme());
    }

    // Expose global
    window.SZ = window.SZ || {};
    window.SZ.theme = { init, get, set: setTheme, apply: applyTheme, cycle: cycleTheme, themes: THEMES.slice() };
})();


