<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Mishwar Hub Thresholds
    |--------------------------------------------------------------------------
    |
    | Minimum approved places required for a governorate hub to be indexable
    | (1..min-1 renders with noindex, follow; 0 returns 404) and for a category
    | hub to render rather than temporarily redirecting (302) to its
    | governorate hub.
    |
    */

    'min_governorate_places' => (int) env('MISHWAR_HUB_MIN_GOVERNORATE_PLACES', 3),

    'min_category_places' => (int) env('MISHWAR_HUB_MIN_CATEGORY_PLACES', 5),

];
