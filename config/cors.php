<?php

return [

    'paths' => [
    'api/*', 
    'sanctum/csrf-cookie', 
    'user',
    'logout',
    'auth/*',
],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_values(array_filter(array_merge(
        env('APP_ENV', 'production') !== 'production'
            ? ['http://localhost:3000', 'http://127.0.0.1:3000']
            : [],
        [env('FRONTEND_URL')],
    ))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
