<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URL'),
    ],

    'google_places' => [
        'key' => env('GOOGLE_PLACES_API_KEY'),
    ],

    'openweather' => [
        'key' => env('OPENWEATHER_API_KEY'),
        'url' => env('OPENWEATHER_API_URL', 'https://api.openweathermap.org/data/2.5/weather'),
    ],

    // all proxied server-side for the same reason as the weather worker above:
    // the browser never calls a third-party host directly, and going through
    // the app gets us caching plus a payload we control.
    'answers' => [
        'url' => env('ANSWERS_API_URL', 'https://answers.syrian.zone'),
    ],

    'recipes' => [
        'url' => env('RECIPES_BASE_URL', 'https://food.syrian.zone'),
    ],

    // graphql proxy also does the today-only filtering the upstream query cannot express
    'events' => [
        'url' => env('EVENTS_GRAPHQL_URL', 'https://event-backend-production-18c4.up.railway.app/graphql'),
    ],

    'prayer' => [
        'url' => env('PRAYER_API_URL', 'https://api.aladhan.com/v1/timings'),
    ],

    // read at runtime, not baked into the bundle, so staging turns analytics off
    // by leaving GA_MEASUREMENT_ID empty in its .env. production keeps the id it
    // has always used.
    'google_analytics' => [
        'id' => env('GA_MEASUREMENT_ID'),
    ],

    'halasyria' => [
        'api_key' => env('HALASYRIA_API'),
        'base_url' => 'https://cfooumftuesvlmphgyhb.supabase.co/rest/v1',
    ],

    'metrics' => [
        // Optional bearer token guarding /api/metrics; unset = public scrape.
        'token' => env('METRICS_TOKEN'),
    ],

    // Lyrics extraction for /syriafy. No key = the feature is simply off.
    'gemini' => [
        'key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-2.5-flash'),
        // override only to point at a proxy/gateway or a test double; no trailing slash
        'base_url' => rtrim(env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com'), '/'),
    ],

];
