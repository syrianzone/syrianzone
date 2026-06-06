<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" suppressHydrationWarning>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    
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
                document.documentElement.setAttribute('data-theme', s || 'dark');
            } catch(e) {}
        })();
    </script>
    
    <!-- Runtime Reverb Config -->
    <script>
        window.REVERB_CONFIG = window.REVERB_CONFIG || {
            host: "{{ config('broadcasting.connections.reverb.host') }}",
            port: {{ config('broadcasting.connections.reverb.options.port', 443) }},
            scheme: "{{ config('broadcasting.connections.reverb.options.scheme', 'https') }}",
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

    <!-- Google Analytics -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-K4H98TC203"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'G-K4H98TC203');
    </script>
</body>
</html>
