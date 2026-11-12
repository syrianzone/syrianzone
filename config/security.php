<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Content-Security-Policy (report-only)
    |--------------------------------------------------------------------------
    |
    | The policy is shipped report-only first: the browser gathers violations
    | but nothing is blocked, so it can be observed against real traffic before
    | it is ever enforced. Set CSP_REPORT_ONLY=false and the header is not sent
    | at all — that is the kill switch, and it needs no code deploy.
    |
    | See App\Http\Middleware\SecurityHeaders for the directives themselves.
    |
    */

    'csp_report_only' => (bool) env('CSP_REPORT_ONLY', true),

    /*
    |--------------------------------------------------------------------------
    | CSP report endpoint
    |--------------------------------------------------------------------------
    |
    | Optional. When set, `report-uri <value>` is appended to the policy so the
    | browser posts violations there. Empty = no reporting, which is fine: the
    | report-only header still shows violations in the visitor's DevTools.
    |
    */

    'csp_report_uri' => env('CSP_REPORT_URI') ?: null,

];
