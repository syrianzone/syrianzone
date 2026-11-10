<?php

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

    'base_url' => env('SEO_BASE_URL', 'https://syrian.zone'),

    'site_name' => 'Syrian Zone',

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
    | Optional @handle for twitter:site. Left null when the account is unknown.
    |
    */

    'twitter_site' => env('SEO_TWITTER_SITE'),

];
