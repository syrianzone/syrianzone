<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Server Side Rendering
    |--------------------------------------------------------------------------
    |
    | These options configure the Inertia Server Side Rendering (SSR) system.
    | You may specify if SSR is enabled, the URL of the SSR server, and the
    | path to the bundle that should be executed by Node.
    |
    */

    'ssr' => [

        'enabled' => true,

        'url' => 'http://127.0.0.1:13714',

        // 'bundle' => base_path('bootstrap/ssr/ssr.js'),

    ],

    /*
    |--------------------------------------------------------------------------
    | Testing
    |--------------------------------------------------------------------------
    |
    | The values defined here will be used while running Inertia tests.
    |
    */

    'testing' => [

        'ensure_pages_exist' => true,

        'page_paths' => [

            resource_path('js/Pages'),

        ],

    ],

];
