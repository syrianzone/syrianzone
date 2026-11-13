<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" dir="rtl" suppressHydrationWarning>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    {{-- Lets the browser theme native UI and the pre-CSS canvas. The inline
         theme script below rewrites it to the resolved theme's scheme. --}}
    <meta name="color-scheme" content="light dark">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    {!! \Sentry\Laravel\Integration::sentryMeta() !!}

    {{-- Per-page SEO and share-preview tags, printed here on every response.
         They never depend on the React tree or on the SSR process: a page that
         renders nothing on the server, or an SSR outage, still sends a
         complete <head> to crawlers and link-preview scrapers. Each tag
         carries `inertia` so <SeoHead> replaces it, rather than duplicating
         it, during client-side navigation. See docs/guidelines/seo.md. --}}
    <title inertia>{{ $meta['title'] ?? config('app.name', 'المساحة السورية | Syrian Zone') }}</title>

    @isset($meta)
    <meta name="description" content="{{ $meta['description'] }}" inertia>
    <link rel="canonical" href="{{ $meta['canonical'] }}" inertia>
    <meta name="robots" content="{{ $meta['robots'] }}" inertia>
    <meta property="og:site_name" content="{{ config('seo.site_name', 'Syrian Zone') }}" inertia>
    <meta property="og:locale" content="ar_SY" inertia>
    <meta property="og:title" content="{{ $meta['og_title'] }}" inertia>
    <meta property="og:description" content="{{ $meta['description'] }}" inertia>
    <meta property="og:type" content="{{ $meta['type'] }}" inertia>
    <meta property="og:url" content="{{ $meta['url'] }}" inertia>
    <meta property="og:image" content="{{ $meta['image'] }}" inertia>
    <meta property="og:image:type" content="{{ $meta['image_type'] }}" inertia>
    <meta property="og:image:width" content="1200" inertia>
    <meta property="og:image:height" content="630" inertia>
    <meta property="og:image:alt" content="{{ $meta['og_title'] }}" inertia>
    <meta name="twitter:card" content="summary_large_image" inertia>
    <meta name="twitter:title" content="{{ $meta['og_title'] }}" inertia>
    <meta name="twitter:description" content="{{ $meta['description'] }}" inertia>
    <meta name="twitter:image" content="{{ $meta['image'] }}" inertia>
    @if (!empty($meta['twitter_site'] ?? config('seo.twitter_site')))
    <meta name="twitter:site" content="{{ $meta['twitter_site'] ?? config('seo.twitter_site') }}" inertia>
    @endif
    @if (!empty($meta['json_ld']))
    {{-- No nonce here on purpose: JSON-LD is a non-executable data block, so
         script-src does not apply to it, and SeoHead re-injects the same block
         client-side after navigation, where no server nonce exists. --}}
    <script type="application/ld+json" inertia>{!! $meta['json_ld'] !!}</script>
    @endif
    @endisset
    
    @php
        $country = request()->header('CF-IPCountry')
            ?: (request()->header('X-Country-Code')
            ?: (request()->server('HTTP_CF_IPCOUNTRY')
            ?: ''));
        $isSyrianIp = strtoupper($country) === 'SY';

        // The theme record shared with Lib/theme.ts and Lib/font.ts. Everything
        // the pre-paint script may name (storage keys, the system preference id,
        // the font defaults, which theme ids are dark) comes from this one file.
        $themeFacts = json_decode(
            file_get_contents(resource_path('data/themes.json')),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );
        $themeKey = $themeFacts['theme']['key'];
        $systemTheme = $themeFacts['theme']['system'];
        $fontKey = $themeFacts['font']['key'];
        $legacySettingsKey = $themeFacts['legacySettingsKey'];
        $syrianDefaultFont = $themeFacts['font']['defaults']['syrian'];
        $otherDefaultFont = $themeFacts['font']['defaults']['other'];
        $darkThemeIds = array_values(array_map(
            static fn (array $theme): string => $theme['id'],
            array_filter($themeFacts['themes'], static fn (array $theme): bool => $theme['isDark']),
        ));
    @endphp

    {{-- Fonts. IBM Plex Sans Arabic is self-hosted (public/fonts, declared in
         app.css): the Google Fonts stylesheet was render-blocking and cost two
         preconnects and a second origin. The family itself is picked at runtime
         from localStorage (the key in resources/data/themes.json, see
         Lib/font.ts), so the server only knows the *default* cohort, from
         IS_SYRIAN_IP below. Preload the one weight nearly all text uses (400)
         only for the cohort whose default is the webfont: visitors defaulted to
         the system stack must not download a file they will never render with. A
         repeat visitor on a non-Syrian IP who explicitly chose the system stack
         still fetches this one file. --}}
    @unless ($isSyrianIp)
    <link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/ibm-plex-sans-arabic/ibm-plex-sans-arabic-regular.woff2">
    @endunless

    <link rel="manifest" href="/manifest.json" />
    <link rel="icon" type="image/png" href="/assets/favicon.png" />
    <link rel="apple-touch-icon" href="/assets/favicon.png" />

    <!-- Theme & Font Flash Prevention: the minimum that must settle before the
         first paint. Ids, storage keys and defaults come from
         resources/data/themes.json (Lib/theme.ts and Lib/font.ts read the same
         file); this script only resolves and applies them. -->
    <script nonce="{{ \Illuminate\Support\Facades\Vite::cspNonce() }}">
        window.IS_SYRIAN_IP = {{ $isSyrianIp ? 'true' : 'false' }};
        (function(){
            try {
                function legacySetting(name) {
                    try {
                        var blob = localStorage.getItem(@json($legacySettingsKey));
                        return blob ? (JSON.parse(blob) || {})[name] : null;
                    } catch (e) {
                        return null;
                    }
                }
                var root = document.documentElement;

                var theme = localStorage.getItem(@json($themeKey)) || legacySetting('theme');
                if (!theme || theme === @json($systemTheme)) {
                    theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
                }
                var scheme = @json($darkThemeIds).indexOf(theme) !== -1 ? 'dark' : 'light';
                root.setAttribute('data-theme', theme);
                root.setAttribute('data-scheme', scheme);
                var schemeMeta = document.querySelector('meta[name="color-scheme"]');
                if (schemeMeta) {
                    schemeMeta.setAttribute('content', scheme);
                }

                var syrianFont = @json($syrianDefaultFont);
                var otherFont = @json($otherDefaultFont);
                var font = localStorage.getItem(@json($fontKey)) || legacySetting('fontFamily');
                if (font !== syrianFont && font !== otherFont) {
                    font = window.IS_SYRIAN_IP ? syrianFont : otherFont;
                }
                root.setAttribute('data-font', font);
            } catch(e) {}
        })();
    </script>
    
    <script nonce="{{ \Illuminate\Support\Facades\Vite::cspNonce() }}">
        window.REVERB_CONFIG = window.REVERB_CONFIG || {
            host: "{{ config('broadcasting.connections.reverb.client.host') }}",
            port: {{ config('broadcasting.connections.reverb.client.port', 443) }},
            scheme: "{{ config('broadcasting.connections.reverb.client.scheme', 'https') }}",
            key: "{{ config('broadcasting.connections.reverb.key') }}",
        };
    </script>
    
    @viteReactRefresh
    @vite(['resources/js/app.tsx'])
    @inertiaHead
</head>
<body class="font-sans antialiased">
    @inertia

    <!-- bfcache: force reload if browser restores a cached Inertia XHR response (shows raw JSON) -->
    <script nonce="{{ \Illuminate\Support\Facades\Vite::cspNonce() }}">
        window.addEventListener('pageshow', function (event) {
            if (event.persisted) {
                // Page was restored from back/forward cache.
                // If the Inertia app root has no rendered children, the browser is
                // displaying the raw JSON payload — force a fresh load.
                var root = document.getElementById('app');
                if (!root || !root.firstChild) {
                    window.location.reload();
                }
            }
        });
    </script>

    <script nonce="{{ \Illuminate\Support\Facades\Vite::cspNonce() }}">
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) {
                        console.log('Service Worker registered with scope: ', reg.scope);
                    })
                    .catch(function(err) {
                        console.error('Service Worker registration failed: ', err);
                    });
            });
        }
    </script>

    <!-- Google Analytics: the id is runtime config, so staging omits it and
         loads nothing. Only the id is exposed here; Lib/analyticsConsent.ts is
         the one place that fetches gtag.js, and only after the visitor agrees. -->
    @if (config('services.google_analytics.id'))
    <script nonce="{{ \Illuminate\Support\Facades\Vite::cspNonce() }}">window.GA_ID = "{{ config('services.google_analytics.id') }}";</script>
    @endif
</body>
</html>
