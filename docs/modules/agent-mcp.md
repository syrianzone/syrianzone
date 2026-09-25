# Agent / MCP Surface (`/mcp/admin`)

Machine access to the admin dashboard for AI agents, built on the official
[`laravel/mcp`](https://laravel.com/docs/mcp) package and Laravel Sanctum.

An agent that holds a scoped token can read and moderate community submissions
through MCP tools, without a browser, a session cookie, or a human clicking
through the dashboard.

---

## 1. What this is (and is not)

- **It is** an agent-facing projection of the existing admin capabilities, gated
  by the same permission vocabulary the dashboard uses.
- **It is not** a second, looser admin API. Agent authorisation is *stricter*
  than the equivalent human session (see §4).
- It is **off by default**. `MCP_ENABLED=false` registers no route at all, so
  the endpoint 404s.

Currently covers **places moderation** (mishwar) only. Other modules are added
by dropping tools into `app/Mcp/Servers/AdminServer.php`; nothing outside that
file is reachable by an agent.

---

## 2. The permission ceiling

The single invariant everything else follows from:

```
effective permission  =  the user's live permission  AND  the token's abilities
```

Both sides must pass. A token can only ever **narrow** what its owner can do;
it is never a grant.

| Property | Consequence |
|---|---|
| User side is read **live**, never snapshotted | Removing `places.approve` from a user (or narrowing `permission_scopes`) stops their agent on the very next call, with no token revocation |
| Token abilities only narrow | A token minted for a `places.review`-only user cannot approve anything, even if the token is later handed to a superadmin |
| `*` is **refused** as a token ability | Sanctum treats `*` as "anything", so such a token would keep working after the capability was removed from the user. Narrow tokens + the live user check avoid that |
| `permission_scopes` stays on the user | Governorate scoping (`transit`) narrows agents identically to humans, and narrowing it takes effect immediately |

Implementation:

| Class | Role |
|---|---|
| `app/Support/Permissions/PermissionCatalogue.php` | The 28 capability ids and their Arabic labels. Single source of truth — `UserResource` delegates to it, so the panel form and the token issuer cannot drift |
| `app/Support/Agents/AgentAuthorizer.php` | Answers "may this agent do X". All methods fail closed |
| `app/Support/Agents/TokenIssuer.php` | Mints tokens: clamps abilities to the owner's live grants, refuses `*`, drops unknown ids, sets an expiry |
| `app/Support/Agents/AgentContext.php` | The per-request identity every tool authorises through |
| `app/Support/Agents/ApiTokenIssuer.php` | Translates the admin form shape into a `TokenIssuer` call, and answers "who may hold a token" |

---

## 3. Request path

`routes/ai.php` is loaded by the package's service provider, **not** by
`bootstrap/app.php` — `withRouting()` has no `ai:` parameter. The route is
registered with an empty middleware group, so it sits outside both `web` and
`api`:

```php
Mcp::web('/mcp/admin', AdminServer::class)
    ->middleware(['auth:sanctum', RequireApiToken::class, 'throttle:mcp']);
```

No session, no CSRF, no cookie authentication. A caller must present a real
bearer token.

`RequireApiToken` (`app/Http/Middleware/RequireApiToken.php`) is not redundant
with `auth:sanctum`. Because the project calls `$middleware->statefulApi()`,
Sanctum will happily authenticate a request from a first-party session cookie
and hand back a `TransientToken`. That would let any logged-in admin's browser
act as an agent with no revocable credential and no token in the audit trail.
The middleware therefore insists on a real `PersonalAccessToken`, rejects
banned owners, rejects foreign or expired tokens, and binds the
`AgentContext`.

### Connecting a client

```
POST https://<host>/mcp/admin
Authorization: Bearer <token>
```

`php artisan mcp:inspector mcp/admin` prints ready-made client configuration.

---

## 4. Agent permissions are stricter than dashboard permissions

The `places_admin` middleware grants the **whole** places group to a caller
holding **any one** places capability — a `places.review` user can approve,
delete and moderate photos through the dashboard. An agent token does not get
that blanket grant:

| Tool | Required capability |
|---|---|
| `list-places`, `get-place` | `places.review` |
| `approve-place`, `reject-place` | `places.approve` |
| `update-place` | `places.edit` |
| `rotate-place-photo`, `delete-place-photo` | `places.moderate_photos` |
| `delete-place` | `places.delete` |

A tool is also **hidden from `tools/list`** when the caller could not invoke it
(`AuditedTool::shouldRegister`). Advertising a tool that 403s wastes context and
invites the agent to burn turns discovering the denial.

### Tool catalogue

Read tools are advertised directly. Every write and destructive tool sits behind
a `ToolSearch` catalogue, so `tools/list` stays short no matter how many modules
are added — agents pick far more reliably from a short list plus a search than
from a flat wall of forty mutations. Catalogue tools are reached via
`search_tools` → `execute_tools`.

Annotations are set deliberately: `#[IsReadOnly]`, `#[IsDestructive]`,
`#[IsIdempotent]`, so a host knows which calls to auto-confirm.

---

## 5. Sharing domain rules, not duplicating them

Tools do **not** call the admin HTTP endpoints (that would need a
session + CSRF dance) and they do **not** re-implement the rules. The domain
logic lives in transport-free services that both the dashboard controller and
the tools call:

- `app/Services/Places/PlaceModerationService.php` — approve/reject/update/delete
  plus the photo rules
- `app/Services/Places/PlacePresenter.php` — the one serialisation shape, so an
  agent and a human never see different fields
- `app/Exceptions/Places/PlaceActionException.php` — refusals carry a `kind`, so
  the controller maps to a status code and the tool maps to an agent-readable
  sentence without either knowing about the other

Invariants preserved in the shared layer: only `pending` places can be
moderated; at most 10 photos and at least 1; both photo-count guards run under
a row lock on the place; every change that can alter the map payload forgets the
`places:map` cache.

`PlaceAdminController` is now a thin HTTP adapter over these. Its 24 existing
tests pass unchanged.

---

## 6. Audit trail

Every tool call writes a row to `mcp_tool_calls` (`app/Models/McpToolCall.php`),
written by `AuditedTool::handle()` so a tool cannot forget:

| Column | Notes |
|---|---|
| `user_id`, `token_id`, `token_name` | `token_name` denormalised; `user_id`/`token_id` nullable so the row survives deletion of either |
| `tool`, `arguments` | Arguments redacted by key (`config('mcp.audit.redact')`), recursively, so a pasted token is not persisted in plaintext |
| `outcome` | `ok` / `denied` / `invalid` / `error` — a refusal is recorded, not silently dropped |
| `error`, `duration_ms`, `ip`, `user_agent` | |

Audit-write failures are logged, never thrown: losing a row must not turn a
successful moderation action into a 500.

Every outcome carries its reason, including a tool that refuses in-domain
(approving an already-approved place): the message is taken off the response,
not just the outcome. Without that the trail recorded `outcome=error` with a
null `error` column — you learn something failed but not what, which is the one
case the log exists for.

The `agent-token-audit` resource exposes **this token's** trail only, so an agent
can confirm its own actions or resume an interrupted sweep without becoming a
window onto other credentials.

---

## 7. Minting tokens

`/admin/api-tokens`, linked from the dashboard sidebar as **رموز الوكلاء**. It
lives with the other `/admin/*` sections rather than in Filament — one UI per
job; the Filament resource that first owned this was removed. Access is
superadmin-only (`superadmin` middleware), matching what the Filament panel
previously enforced via `canAccessPanel()`. Minting a token grants capability to
an automated client, so unlike the moderation panels it is not delegated to
module admins.

Pick a user, a name, a TTL (7/30/90/180 days, default 30) and the capabilities.
The page also shows the ready-to-paste `curl` and points at
`php artisan mcp:inspector mcp/admin`.

- The **plaintext is shown once**, in the confirmation notification. Only its
  hash is stored, so a lost token cannot be recovered — mint a replacement.
- There is deliberately **no edit action**. Capabilities and expiry are fixed at
  issue time; a credential that can be quietly widened afterwards is one nobody
  audited. Change it by revoking and re-issuing.
- `revoke_all` drops every token for a user at once — the right move on a
  suspected leak.
- Banning a user is enforced by `RequireApiToken` on every call. This closes a
  pre-existing gap: `is_banned` was checked at login and in `canAccessPanel`, but
  on **no** admin endpoint, so a ban was advisory for a long-lived credential.

Rate limiting: `throttle:mcp`, 120/min, keyed by **token id** so one noisy agent
cannot exhaust another's budget on a shared egress IP.

---

## 8. Trying it locally

```bash
# 1. the surface is off unless you opt in
echo 'MCP_ENABLED=true' >> .env && php artisan config:clear

# 2. mint a token (or use /admin/api-tokens in the UI)
php artisan tinker --execute='
  $u = App\Models\User::where("role","superadmin")->first();
  echo app(App\Support\Agents\TokenIssuer::class)
        ->issue($u, "local-test", ["places.review","places.approve"])
        ["token"]->plainTextToken;'

# 3. call it
curl -s -X POST http://localhost:8000/mcp/admin \
  -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Without a token you get `401`. With a valid one you get the tool list scoped to
that token's capabilities.

Three protocol details that cost time, all found by driving a real session:

- **`Accept: application/json, text/event-stream` is required.** The MCP HTTP
  transport negotiates SSE; without it the client is refused.
- **`execute_tools` answers as SSE even when it does not stream.** Its response
  is `Content-Type: text/event-stream` with `data: {json}` frames, while a
  direct `tools/call` for an advertised tool is plain `application/json`. A
  client that only does `json.loads(body)` will fail on the catalogue path —
  strip the `data: ` prefix, or branch on the content type.
- **A browser session beats the bearer token.** `config('sanctum.guard')` lists
  `web` first, so if a logged-in cookie is also sent, Sanctum resolves *that*
  user and `RequireApiToken` rejects the resulting `TransientToken` with 403.
  This is intended — a session is not a revocable agent credential — but it
  means you cannot test the agent endpoint from a logged-in browser tab with
  `fetch`. Use curl, or send no cookie.

Resource URIs are pinned with `#[Uri]` rather than left to the class-name
default, so the `uri` an agent reads in `resources/list` matches the `name`:

| Resource | URI |
|---|---|
| `agent-permissions` | `syrianzone://agent/permissions` |
| `agent-token-audit` | `syrianzone://agent/audit-trail` |

If a code change appears not to take effect, note that the dev server keeps
`opcache` with `revalidate_freq=180`: a long-running `php artisan serve` can
serve a stale compile for up to three minutes. Restart it if in doubt.

## 9. Tests

`tests/Feature/Agent/` — 54 tests:

| File | Covers |
|---|---|
| `AgentAuthorizationTest.php` | The ceiling: clamping, wildcard refusal, live revocation, governorate scoping, fail-closed paths |
| `AgentHttpTest.php` | The edge: feature flag, guest, session-cookie refusal, ban, expiry, revocation, real bearer round trip |
| `PlacesToolsTest.php` | Tool behaviour, domain refusals, `shouldRegister` gating, audit outcomes, redaction |
| `ApiTokenIssuingTest.php` | Form → token: clamping, banned owners, unknown ids, TTL fallback |

Two notes for anyone extending this:

- Catalogue tools cannot be driven by the package's `AdminServer::tool(...)`
  helper (it resolves primitives by class name, and `ToolSearch` needs its tools
  injected). Use the `callTool()` helper in `tests/Pest.php`, which invokes
  `handle()` exactly as the MCP `ToolInvoker` does.
- `Response::structured()` returns a `ResponseFactory`, not a `Response`. Tool
  `run()` signatures are `Response|ResponseFactory` for that reason.

---

## 10. Adding a module

1. Extract the module's admin logic into a transport-free service under
   `app/Services/<Module>/`, and point the existing controller at it.
2. Add tools in `app/Mcp/Tools/<Module>/` extending `AuditedTool`, declaring
   `$permissions`.
3. Register them in `app/Mcp/Servers/AdminServer.php` — read tools directly,
   writes inside the `ToolSearch` array.
4. Add tests. If the module is governorate-scoped, override
   `isCityScoped()`/`cityIdFor()` so the scope is enforced.

**Do not** add a parallel permission vocabulary. If a module needs a capability
that does not exist, add it to `PermissionCatalogue` — it is the same list the
Filament user form renders.
