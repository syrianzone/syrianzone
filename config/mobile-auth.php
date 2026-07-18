<?php

$redirectUris = array_values(array_filter(array_map(
    'trim',
    explode(',', (string) env(
        'MOBILE_AUTH_REDIRECT_URIS',
        'syrianzone://auth/callback',
    )),
)));

return [
    'allowed_redirect_uris' => $redirectUris,
    'google_redirect_url' => env('MOBILE_AUTH_GOOGLE_REDIRECT_URL'),
    'authorization_ttl_minutes' => (int) env('MOBILE_AUTH_AUTHORIZATION_TTL_MINUTES', 10),
    'exchange_ttl_minutes' => (int) env('MOBILE_AUTH_EXCHANGE_TTL_MINUTES', 2),
    'token_ttl_minutes' => (int) env('MOBILE_AUTH_TOKEN_TTL_MINUTES', 43_200),
];
