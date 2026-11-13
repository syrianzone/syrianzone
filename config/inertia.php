<?php

return [

    'ssr' => [

        // On by default: the SSR server is part of the stack (docker/s6/inertia-ssr-run
        // in production, `bun run dev` locally). Inertia falls back to client-side
        // rendering automatically when the bundle is missing or the server is down
        // (HttpGateway::dispatch returns null), so a failure degrades rather than
        // 500s. Set INERTIA_SSR_ENABLED=false to force it off.
        'enabled' => env('INERTIA_SSR_ENABLED', true),

        'url' => 'http://127.0.0.1:13714',

    ],

    'pages' => [

        'ensure_pages_exist' => false,

        'paths' => [

            resource_path('js/Pages'),

        ],

        'extensions' => [

            'js',
            'jsx',
            'svelte',
            'ts',
            'tsx',
            'vue',

        ],

    ],

    'testing' => [

        'ensure_pages_exist' => true,

    ],

];
