<?php

return [
    'session_ttl_minutes' => (int) env('GUESS_WHO_SESSION_TTL_MINUTES', 120),
    'stun_urls' => array_values(array_filter(explode(',', env('GUESS_WHO_STUN_URLS', 'stun:stun.l.google.com:19302')))),
    'turn_urls' => array_values(array_filter(explode(',', env('GUESS_WHO_TURN_URLS', '')))),
    'turn_secret' => env('GUESS_WHO_TURN_SECRET'),
    'turn_ttl_minutes' => (int) env('GUESS_WHO_TURN_TTL_MINUTES', 10),
];
