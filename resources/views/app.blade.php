<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" suppressHydrationWarning>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    {{-- links the browser pageload trace to the backend request that rendered it --}}
    {!! \Sentry\Laravel\Integration::sentryMeta() !!}

    <title inertia>{{ config('app.name', 'المساحة السورية | Syrian Zone') }}</title>
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@100;200;300;400;500;600;700&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&display=swap" rel="stylesheet" />
    
    <!-- Meta/Icons -->
    <link rel="manifest" href="/manifest.json" />
    <link rel="icon" type="image/png" href="/assets/favicon.png" />
    <link rel="shortcut icon" type="image/png" href="/assets/favicon.png" />
    <link rel="apple-touch-icon" href="/assets/favicon.png" />
    
    <!-- Theme Flash Prevention -->
    <script>
        (function(){
            try {
                var s = localStorage.getItem('sz-theme');
                if(!s) {
                    var sp = localStorage.getItem('startpage-settings');
                    if(sp) {
                        s = (JSON.parse(sp)||{}).theme;
                    }
                }
                // no saved choice (or explicit 'system'): follow the device scheme
                if(!s || s === 'system') {
                    s = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
                }
                document.documentElement.setAttribute('data-theme', s);
            } catch(e) {}
        })();
    </script>
    
    <!-- Runtime Reverb Config -->
    <script>
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
    <script>
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
    <script>
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
    <script>window.GA_ID = "{{ config('services.google_analytics.id') }}";</script>
    <script async src="https://www.googletagmanager.com/gtag/js?id={{ config('services.google_analytics.id') }}"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', "{{ config('services.google_analytics.id') }}");
    </script>
    @endif
</body>
</html>
