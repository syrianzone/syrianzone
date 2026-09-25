<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Enabled
    |--------------------------------------------------------------------------
    |
    | Master switch for the /mcp/* surface. When false, no MCP route is
    | registered at all and the endpoint 404s, so an environment can keep the
    | package installed while the surface stays closed. Set MCP_ENABLED=true
    | only on environments where agents are expected to connect.
    |
    */

    'enabled' => env('MCP_ENABLED', false),

    /*
    |--------------------------------------------------------------------------
    | Rate Limiting
    |--------------------------------------------------------------------------
    |
    | Named limiter applied to the /mcp/* routes. It is keyed by API token id
    | (falling back to the authenticated user id, then the client IP) so one
    | noisy agent cannot exhaust the budget of another token sharing an egress
    | IP. The limit itself is registered in App\Providers\AppServiceProvider.
    |
    */

    'rate_limiter' => 'mcp',

    /*
    |--------------------------------------------------------------------------
    | Audit Logging
    |--------------------------------------------------------------------------
    | See the header of routes/ai.php before changing these.
    */

    'audit' => [
        'enabled' => env('MCP_AUDIT_ENABLED', true),

        // Redact these argument keys before they reach the audit table, at any
        // depth. Arguments are stored as JSON, so an unredacted prompt or a
        // freshly minted token pasted into a tool argument would otherwise be
        // persisted in plaintext.
        'redact' => [
            'token',
            'plain_text_token',
            'plainTextToken',
            'password',
            'secret',
            'authorization',
            'api_key',
            'apiKey',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Redirect Domains
    |--------------------------------------------------------------------------
    |
    | These domains are the domains that OAuth clients are permitted to use
    | for redirect URIs. Each domain should be specified with its scheme
    | and host. Domains not in this list will raise validation errors.
    |
    | An "*" may be used to allow all domains.
    |
    */

    'redirect_domains' => [
        '*',
        // 'https://example.com',
        // 'http://localhost',
    ],

    /*
    |--------------------------------------------------------------------------
    | Allowed Custom Schemes
    |--------------------------------------------------------------------------
    |
    | Native desktop OAuth clients like Cursor and VS Code use private-use URI
    | schemes (RFC 8252) for redirect callbacks instead of standard schemes
    | like HTTPS. Here, you may list which custom schemes you will allow.
    |
    */

    'custom_schemes' => [
        // 'claude',
        // 'cursor',
        // 'vscode',
    ],

    /*
    |--------------------------------------------------------------------------
    | Authorization Server
    |--------------------------------------------------------------------------
    |
    | Here you may configure the OAuth authorization server issuer identifier
    | per RFC 8414. This value appears in your protected resource and auth
    | server metadata endpoints. When null, this defaults to `url('/')`.
    |
    */

    'authorization_server' => null,

    /*
    |--------------------------------------------------------------------------
    | Tool Search
    |--------------------------------------------------------------------------
    |
    | Here you may configure the limits enforced during tool search. The max
    | number of tool calls limits how many tools search requests can call
    | while the maximum output bytes value will limit the result sizes.
    |
    */

    'tool_search' => [
        'max_tool_calls' => 10,
        'max_output_bytes' => 65_536,
    ],

];
