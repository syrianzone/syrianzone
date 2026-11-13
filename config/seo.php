<?php

use App\Support\Facts;

return [

    /*
    |--------------------------------------------------------------------------
    | Canonical host
    |--------------------------------------------------------------------------
    |
    | Absolute URLs (canonical, og:url, sitemap) are built against this host, not
    | the request host, so staging — which answers on a different hostname —
    | never advertises itself as the canonical site. Override with SEO_BASE_URL.
    |
    */

    'base_url' => env('SEO_BASE_URL', Facts::site()['base_url']),

    'site_name' => 'Syrian Zone',

    /*
    |--------------------------------------------------------------------------
    | Identity
    |--------------------------------------------------------------------------
    |
    | The Arabic name the site also goes by, and the profiles that are the same
    | project elsewhere. Both go into the Organization and WebSite structured
    | data, so a search engine can tell that "المساحة السورية" and "Syrian
    | Zone" are one thing and which accounts are its own.
    |
    */

    'alternate_name' => 'المساحة السورية',

    'same_as' => [
        'https://github.com/syrianzone/syrianzone',
        'https://x.com/SyrianZone',
    ],

    /*
    |--------------------------------------------------------------------------
    | Defaults
    |--------------------------------------------------------------------------
    |
    | Used for any page the resolver has no specific entry for. The default
    | share image is the site's own card (App\Support\Seo\Og\StaticCards).
    |
    */

    'default_title' => 'المساحة السورية — منصة سورية مفتوحة المصدر',

    'default_description' => 'المساحة السورية - منصة تفاعلية تجمع وتوفر الموارد والخدمات والمعلومات المفتوحة المتعلقة بالشأن السوري: استطلاعات رأي، أدلة رسمية، أطلس، ترانزيت، وهويات بصرية.',

    /*
    |--------------------------------------------------------------------------
    | Twitter
    |--------------------------------------------------------------------------
    |
    | The @handle for twitter:site: the account the site's own cards are posted
    | from. Set SEO_TWITTER_SITE to an empty value to leave the tag out.
    |
    */

    'twitter_site' => env('SEO_TWITTER_SITE', '@SyrianZone'),

    /*
    |--------------------------------------------------------------------------
    | Share cards drawn on demand
    |--------------------------------------------------------------------------
    |
    | Cards of single records (a promise, a place...) are drawn by a Node script
    | the first time they are requested. `image_hosts` lists extra hosts a card
    | may fetch a photo from, beyond this site's own media storage.
    |
    */

    'cards' => [
        'node' => env('OG_NODE_BINARY', 'node'),
        'timeout' => (int) env('OG_RENDER_TIMEOUT', 10),
        'image_hosts' => array_values(array_filter(array_map('trim', explode(',', (string) env('OG_IMAGE_HOSTS', ''))))),
    ],

];
