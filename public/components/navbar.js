class NavBar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._themeObserver = null;
  }

  connectedCallback() {
    this.render();
    if (!this.hasAttribute('no-theme-sync')) {
      this.reflectThemeToHost();
      this.observeTheme();
    }
    this.addEventListeners();
    this.highlightActivePage();
  }

  disconnectedCallback() {
    this._themeObserver?.disconnect();
  }

  reflectThemeToHost() {
    const t = document.documentElement.getAttribute('data-theme') || 'dark';
    this.setAttribute('data-theme', t);
  }

  observeTheme() {
    this._themeObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'data-theme') {
          this.reflectThemeToHost();
        }
      }
    });
    this._themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  highlightActivePage() {
    const currentPath = window.location.pathname;
    const navItems = this.shadowRoot.querySelectorAll('.nav-item');
    const mobileTitle = this.shadowRoot.querySelector('.mobile-title');

    navItems.forEach(item => {
      const href = item.getAttribute('href');
      if ((href === '/' && currentPath === '/') || (href !== '/' && currentPath.startsWith(href))) {
        item.classList.add('active');
        if (mobileTitle) {
          mobileTitle.innerHTML = item.innerHTML;
        }
      }
    });
  }

  addEventListeners() {
    const menuButton = this.shadowRoot.querySelector('.menu-button');
    const navItems = this.shadowRoot.querySelector('.nav-items');
    const navbar = this.shadowRoot.querySelector('.navbar');
    const themeButtons = this.shadowRoot.querySelectorAll('.theme-button');

    // Safely handle menu button click
    menuButton?.addEventListener('click', () => {
      navItems?.classList.toggle('show');
      menuButton.classList.toggle('active');
      navbar?.classList.toggle('menu-open');
    });

    if (!this.hasAttribute('no-theme-sync')) {
      themeButtons?.forEach(btn => btn.addEventListener('click', () => {
        if (window.SZ?.theme) {
          window.SZ.theme.cycle();
        }
      }));
    }
  }

  render() {
    const disableThemeSync = this.hasAttribute('no-theme-sync');
    const baseAttr = this.getAttribute('base-path');
    const htmlBase = document.documentElement?.getAttribute('data-base-path');
    const globalBase = (window.SZ && window.SZ.basePath) || '';
    const basePath = baseAttr || htmlBase || globalBase || '';

    const assetBaseAttr = this.getAttribute('asset-base');
    const assetBase = assetBaseAttr !== null ? assetBaseAttr : basePath;
    const assetPath = (path) => {
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const normalizedPrefix = (assetBase || '').replace(/\/+$/, '');
      return normalizedPrefix ? `${normalizedPrefix}${normalizedPath}` : normalizedPath;
    };
    const mobileThemeButton = disableThemeSync ? '' : `
              <button class="theme-button" title="Toggle theme">
                <i class="fas fa-adjust"></i>
              </button>`;

    const desktopThemeButton = disableThemeSync ? '' : `
            <!-- Desktop theme toggle -->
            <button class="theme-button" title="Toggle theme">
              <i class="fas fa-adjust"></i>
            </button>`;

    this.shadowRoot.innerHTML = `
      <style>
        @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css');
        :host {
          display: block;
          font-family: "IBM Plex Sans Arabic", sans-serif;
          direction: rtl;
        }
        .navbar {
          background-color: var(--sz-color-surface);
          backdrop-filter: blur(10px);
          border-bottom: 4px solid var(--border-color);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          position: relative;
          z-index: 1000;
        }
        .navbar.menu-open {
          box-shadow: none;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0.5rem 1rem;
        }
        .nav-items {
          display: flex;
          justify-content: center;
          gap: 1.5rem;
          flex-wrap: wrap;
        }
        .nav-item {
          display: flex;
          align-items: center;
          text-decoration: none;
          color: var(--sz-color-ink);
          padding: 0.5rem 0.75rem;
          border: 4px solid transparent;
          border-radius: 0px;
          transition: all 0.2s;
          font-size: 0.95rem;
        }
        .nav-item:hover {
          background-color: var(--bg-tertiary);
        }
        .nav-item.active {
          background-color: color-mix(in oklab, var(--sz-color-primary) 12%, var(--sz-color-surface));
          color: var(--sz-color-secondary);
          border-color: var(--border-color);
          font-weight: 500;
        }
        .nav-item i {
          margin-left: 0.5rem;
          font-size: 1.1rem;
        }
        .menu-button {
          display: none;
          background: none;
          border: 4px solid transparent;
          cursor: pointer;
          padding: 0.5rem;
          color: var(--sz-color-ink);
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 0px;
        }
        .menu-button:hover {
          background-color: var(--bg-tertiary);
        }
        .menu-button i {
          font-size: 1.25rem;
        }
        /* Theme button visible on all viewports */
        .theme-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          border-radius: 0px;
          border: 4px solid var(--border-color);
          background: var(--sz-color-surface);
          color: var(--sz-color-ink);
          cursor: pointer;
        }
        .theme-button:hover {
          background-color: var(--bg-tertiary);
        }
        .mobile-header {
          display: none;
        }
        /* Theme-aware logo swap using reflected attribute on host */
        .logo img.logo-light { display: none; }
        .logo img.logo-dark { display: inline-block; }
        :host([data-theme="light"]) .logo img.logo-light { display: inline-block; }
        :host([data-theme="light"]) .logo img.logo-dark { display: none; }
        @media (max-width: 768px) {
          .navbar {
            position: fixed;
            top: 0;
            right: 0;
            left: 0;
            z-index: 1000;
          }
          .navbar-spacer {
            padding-top: 3rem;
          }
          .mobile-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.25rem;
            position: relative;
          }
                  .mobile-title {
          display: flex;
          align-items: center;
          font-weight: 500;
          color: var(--sz-color-primary);
          font-size: 1rem;
        }
        .mobile-title i {
          margin-left: 0.5rem;
        }
        .logo {
          display: flex;
          align-items: center;
          text-decoration: none;
          color: var(--sz-color-primary);
          font-weight: 600;
          font-size: 1.1rem;
        }
        .logo img {
          height: 2rem;
          width: auto;
          margin-left: 0.5rem;
        }
        .desktop-logo {
          display: none;
        }
        @media (min-width: 769px) {
          .desktop-logo {
            display: flex;
            align-items: center;
            margin-left: 1rem;
          }
          .mobile-title {
            display: none;
          }
        }
          .mobile-actions {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            position: relative;
          }
          .menu-button {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .nav-items {
            display: none;
            flex-direction: column;
            gap: 0.25rem;
            position: absolute;
            top: 100%;
            right: 0;
            left: 0;
            background-color: var(--sz-color-surface);
            padding: 0.5rem;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .nav-items.show {
            display: flex;
          }
          .nav-item {
            padding: 0.75rem;
            width: 100%;
            justify-content: flex-start;
            border-radius: 0rem;
          }
          .nav-item.active {
            background-color: color-mix(in oklab, var(--sz-color-primary) 12%, var(--sz-color-surface));
          }
          .container {
            padding: 0 0.5rem;
          }
        }
      </style>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css">
      <nav class="navbar">
        <div class="container">
          <div class="mobile-header">
            <a href="/" class="logo">
              <img src="${assetPath('/assets/logo-lightmode.svg')}" class="logo-light" alt="Syrian Zone" onerror="this.onerror=null; this.src='${basePath}/placeholder-logo.svg'">
              <img src="${assetPath('/assets/logo-darkmode.svg')}" class="logo-dark" alt="Syrian Zone" onerror="this.onerror=null; this.src='${basePath}/placeholder-logo.svg'">
            </a>
            <div class="mobile-actions">
              ${mobileThemeButton}
              <button class="menu-button">
                <i class="fas fa-bars"></i>
              </button>
            </div>
          </div>
          <div class="nav-items">
            <div class="desktop-logo">
              <a href="/" class="logo">
                <img src="${assetPath('/assets/logo-lightmode.svg')}" class="logo-light" alt="Syrian Zone" style="height: 50px;" onerror="this.onerror=null; this.src='${basePath}/placeholder-logo.svg'">
                <img src="${assetPath('/assets/logo-darkmode.svg')}" class="logo-dark" alt="Syrian Zone" style="height: 50px;" onerror="this.onerror=null; this.src='${basePath}/placeholder-logo.svg'">
              </a>
            </div>

            <a href="/syofficial" class="nav-item">
              <i class="fas fa-check-circle" style="color: var(--sz-color-ink);"></i>
              الحسابات الرسمية 
            </a>
            <a href="/syid" class="nav-item">
              <i class="fas fa-palette" style="color: var(--sz-color-ink);"></i>
              الهوية البصرية 
            </a>
            <a href="/party" class="nav-item">
              <i class="fas fa-users" style="color: var(--sz-color-ink);"></i>
              دليل الأحزاب
            </a>
            <a href="/tierlist" class="nav-item">
              <i class="fas fa-list-ol" style="color: var(--sz-color-ink);"></i>
              تير ليست الحكومة
            </a>
            <a href="/house" class="nav-item">
              <i class="fas fa-landmark" style="color: var(--sz-color-ink);"></i>
              المجلس التشريعي
            </a>
            <a href="/compass" class="nav-item">
              <i class="fas fa-compass" style="color: var(--sz-color-ink);"></i>
              البوصلة السياسية
            </a>
            <a href="/alignment" class="nav-item">
              <i class="fas fa-crosshairs" style="color: var(--sz-color-ink);"></i>
              بوصلة مخصصة
            </a>
            <a href="/sites" class="nav-item">
              <i class="fas fa-globe" style="color: var(--sz-color-ink);"></i>
              المواقع السورية
            </a>
            <a href="/syrian-contributors" class="nav-item">
              <i class="fas fa-code" style="color: var(--sz-color-ink);"></i>
              المساهمون السوريون
            </a>
            <a target="_blank" href="https://chromewebstore.google.com/detail/syrian-flag-replacer/dngipobppehfhfggmbdiiiodgcibdeog" class="nav-item">
              <img src="${assetPath('/flag-replacer/1f1f8-1f1fe.svg')}" alt="Flag Replacer" style="height: 1.1rem; width: 1.1rem; margin-left: 0.5rem;" onerror="this.onerror=null; this.src='${basePath}/syria-flag.svg'">
              مبدل العلم
            </a>
            <a target="_blank" href="https://wrraq.com" class="nav-item">
              <i class="fas fa-comments" style="color: var(--sz-color-accent);"></i>
              المنتدى
            </a>
            ${desktopThemeButton}
          </div>
        </div>
      </nav>
      <div class="navbar-spacer"></div>
    `;
  }
}

customElements.define('nav-bar', NavBar); 
