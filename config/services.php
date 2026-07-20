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

    // proxied server-side: the worker only sends CORS headers for the production
    // origin, so a browser call fails on staging and in local dev.
    'weather' => [
        'url' => env('WEATHER_WORKER_URL', 'https://syrianzone.hade-alahmad1.workers.dev/'),
    ],

<<<<<<< HEAD
<<<<<<< HEAD
    // proxied server-side like the weather worker: a browser call would be
    // cross-origin, and fetching here gives us caching and a stable payload.
    'answers' => [
        'url' => env('ANSWERS_API_URL', 'https://answers.syrian.zone'),
    // proxied server-side for the same reason as the weather worker: a sibling
    // app on another origin, so the browser must never call it directly.
    'recipes' => [
        'url' => env('RECIPES_BASE_URL', 'https://food.syrian.zone'),
=======
    // proxied server-side like the weather worker: a third-party host is never
    // called from the browser, and going through the app gets us caching plus
    // the today-only filtering the upstream query cannot express.
    'events' => [
        'url' => env('EVENTS_GRAPHQL_URL', 'https://event-backend-production-18c4.up.railway.app/graphql'),
>>>>>>> board/events-widget
=======
    // proxied server-side for the same reason as the weather worker: relying on
    // a third party's CORS policy staying permissive is what broke that widget.
    'prayer' => [
        'url' => env('PRAYER_API_URL', 'https://api.aladhan.com/v1/timings'),
>>>>>>> board/prayer-weather-extend
    ],

    // read at runtime, not baked into the bundle, so staging turns analytics off
    // by leaving GA_MEASUREMENT_ID empty in its .env. production keeps the id it
    // has always used.
    'google_analytics' => [
        'id' => env('GA_MEASUREMENT_ID'),
    ],

];
