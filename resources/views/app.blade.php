<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" dir="rtl" suppressHydrationWarning>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    {{-- Lets the browser theme native UI and the pre-CSS canvas. The inline
         theme script below rewrites it to the resolved theme's scheme. --}}
    <meta name="color-scheme" content="light dark">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    {{-- links the browser pageload trace to the backend request that rendered it --}}
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
    @endphp

    {{-- Fonts. IBM Plex Sans Arabic is self-hosted (public/fonts, declared in
         app.css): the Google Fonts stylesheet was render-blocking and cost two
         preconnects and a second origin. The family itself is picked at runtime
         from localStorage ('sz-font', see Lib/font.ts), so the server only knows
         the *default* cohort, from IS_SYRIAN_IP below. Preload the one weight
         nearly all text uses (400) only for the cohort whose default is the
         webfont: visitors defaulted to the system stack must not download a file
         they will never render with. A repeat visitor on a non-Syrian IP who
         explicitly chose the system stack still fetches this one file. --}}
    @unless ($isSyrianIp)
    <link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/ibm-plex-sans-arabic/ibm-plex-sans-arabic-regular.woff2">
    @endunless

    <!-- Meta/Icons -->
    <link rel="manifest" href="/manifest.json" />
    <link rel="icon" type="image/png" href="/assets/favicon.png" />
    <link rel="apple-touch-icon" href="/assets/favicon.png" />

    <!-- Theme & Font Flash Prevention -->
    <script nonce="{{ \Illuminate\Support\Facades\Vite::cspNonce() }}">
        window.IS_SYRIAN_IP = {{ $isSyrianIp ? 'true' : 'false' }};
        (function(){
            try {
                var s = localStorage.getItem('sz-theme');
                if(!s) {
                    var sp = localStorage.getItem('startpage-settings');
                    if(sp) {
                        s = (JSON.parse(sp)||{}).theme;
                    }
                }
                if(!s || s === 'system') {
                    s = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
                }
                document.documentElement.setAttribute('data-theme', s);

                // Theme ids whose isDark is true in resources/js/Lib/theme.ts
                // (the source of truth). Keep this list in step with it.
                var darkThemes = ['dark', 'dark-blue', 'dark-purple', 'dark-green', 'high-contrast', 'damascus-rose'];
                var schemeMeta = document.querySelector('meta[name="color-scheme"]');
                if(schemeMeta) {
                    schemeMeta.setAttribute('content', darkThemes.indexOf(s) !== -1 ? 'dark' : 'light');
                }

                var f = localStorage.getItem('sz-font');
                if(!f) {
                    var spFont = localStorage.getItem('startpage-settings');
                    if(spFont) {
                        f = (JSON.parse(spFont)||{}).fontFamily;
                    }
                }
                if(!f || (f !== 'system' && f !== 'ibm-plex')) {
                    f = window.IS_SYRIAN_IP ? 'system' : 'ibm-plex';
                }
                document.documentElement.setAttribute('data-font', f);
            } catch(e) {}
        })();
    </script>
    
    <!-- Runtime Reverb Config -->
    <script nonce="{{ \Illuminate\Support\Facades\Vite::cspNonce() }}">
        window.REVERB_CONFIG = window.REVERB_CONFIG || {
            host: "{{ config('broadcasting.connections.reverb.client.host') }}",
            port: {{ config('broadcasting.connections.reverb.client.port', 443) }},
            scheme: "{{ config('broadcasting.connections.reverb.client.scheme', 'https') }}",
            key: "{{ config('broadcasting.connections.reverb.key') }}",
        };
    </script>
    
    <!-- Scripts & Styles -->
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

    <!-- Service Worker Registration -->
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

    <!-- Google Analytics: id is runtime config, so staging omits it and loads nothing -->
    @if (config('services.google_analytics.id'))
    <script nonce="{{ \Illuminate\Support\Facades\Vite::cspNonce() }}">window.GA_ID = "{{ config('services.google_analytics.id') }}";</script>
    <script async src="https://www.googletagmanager.com/gtag/js?id={{ config('services.google_analytics.id') }}" nonce="{{ \Illuminate\Support\Facades\Vite::cspNonce() }}"></script>
    <script nonce="{{ \Illuminate\Support\Facades\Vite::cspNonce() }}">
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', "{{ config('services.google_analytics.id') }}");
    </script>
    @endif
</body>
</html>
