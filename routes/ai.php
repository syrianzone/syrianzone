<?php

use App\Http\Middleware\RequireApiToken;
use App\Mcp\Servers\AdminServer;
use Laravel\Mcp\Facades\Mcp;

/*
|--------------------------------------------------------------------------
| Agent (MCP) surface
|--------------------------------------------------------------------------
|
| Registered outside the `web` and `api` middleware groups, so no session, no
| CSRF, and no cookie authentication: a caller must present a real bearer API
| token. That is what makes an agent credential independently revocable and
| auditable — a browser session would be neither.
|
| Middleware order matters:
|
|   auth:sanctum      resolves the bearer token into a user
|   RequireApiToken    rejects TransientToken (session-cookie) auth, rejects
|                      banned owners, rejects foreign/expired tokens, and binds
|                      the AgentContext every tool authorises through
|   throttle:mcp       per-token budget, so one noisy agent cannot starve another
|
| Per-tool authorisation is separate and stricter than the web dashboard:
| `places.review` gets read-only tools, while approving, rejecting, editing,
| moderating photos and deleting are each gated on their own capability. The
| `places_admin` middleware grants the whole group on any one capability, so an
| agent token is deliberately narrower than an equivalent human session.
|
| MCP_ENABLED=false registers nothing at all, so the endpoint 404s. Keep it off
| anywhere agents are not expected to connect.
|
*/

if (config('mcp.enabled')) {
    Mcp::web('/mcp/admin', AdminServer::class)
        ->middleware([
            'auth:sanctum',
            RequireApiToken::class,
            'throttle:'.config('mcp.rate_limiter', 'mcp'),
        ]);
}
