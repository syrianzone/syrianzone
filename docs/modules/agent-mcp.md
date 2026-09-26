# Agent / MCP Surface (`/mcp/admin`)

Machine access to the admin dashboard for AI agents, built on the official
[`laravel/mcp`](https://laravel.com/docs/mcp) package and Laravel Sanctum.

An agent that holds a scoped token can read and moderate community submissions
and administer the content directories, without a browser, a session cookie, or a
human clicking through the dashboard.

---

## 1. What this is (and is not)

- **It is** an agent-facing projection of the existing admin capabilities, gated
  by the same permission vocabulary the dashboard uses.
- **It is not** a second, looser admin API. Agent authorisation is *stricter*
  than the equivalent human session (see §4).
- It is **off by default**. `MCP_ENABLED=false` registers no route at all, so
  the endpoint 404s.

Currently covers five modules:

| Module | Read tools | Write tools | Scoped |
|---|---:|---:|---|
| Places (mishwar) | 2 | 6 | no |
| SyOfficial directory | 2 | 10 | no |
| Government apps | 1 | 6 | no |
| Transit | 4 | 6 | **yes**, by governorate |
| Users | 0 | 1 | no |

Other modules are added by dropping tools into
`app/Mcp/Servers/AdminServer.php`; nothing outside that file is reachable by an
agent. One pair of transit operations is intentionally dashboard-only — see
§5, "What is deliberately *not* exposed to agents".

`Users` has no read tool: there is no `list-users`, so an agent cannot browse
accounts. Ids have to come from the operator. That is a deliberate gap — user
enumeration is a privacy question, and a moderation capability should not double
as a directory of everybody's email addresses.

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

A tool requires its capability specifically. The dashboard's admin panels now do
the same — see [routes-api-map.md](../reference/routes-api-map.md) and
`ModuleCapabilityGuard` — so the two surfaces agree, and the agent rules below
are no longer the only place a distinction is drawn. What remains stricter:

| Tool | Required capability |
|---|---|
| `list-places`, `get-place` | `places.review` |
| `approve-place`, `reject-place` | `places.approve` |
| `update-place` | `places.edit` |
| `rotate-place-photo`, `delete-place-photo` | `places.moderate_photos` |
| `delete-place` | `places.delete` |

Three things the agent surface adds on top of the dashboard:

- **A token ceiling.** The dashboard trusts `users.permissions`; an agent
  additionally has its token's abilities, and the effective permission is the
  intersection. So a superadmin can hand out a narrow token without touching the
  user's row.
- **One capability per call, always.** The dashboard can group capabilities per
  route, and a route that mutates several things may need more than one; a tool
  declares exactly what it needs.
- **Every call is audited** in `mcp_tool_calls`, including the arguments and the
  outcome.

A tool is also **hidden from `tools/list`** when the caller could not invoke it
(`AuditedTool::shouldRegister`). Advertising a tool that 403s wastes context and
invites the agent to burn turns discovering the denial.

### Any-of gates

`AuditedTool` supports two declarations, and the difference matters:

- `protected array $permissions` — **all** of these are required.
- `protected array $anyPermissions` — **any one** of these is enough.

The SyOfficial and Gov Apps catalogues are `create` / `edit` / `toggle` /
`delete` / `reorder`, with no read-only entry. Their read tools therefore use
`$anyPermissions`: requiring a *write* grant in order to *look* would be wrong,
and adding a sixth `*.review` capability would silently change what every
existing role and token resolves to. Any-of is the honest reading of the
catalogue as it stands. If a module later gets a real read capability, swap the
declaration to `$permissions`.

`restore-gov-app` is the one tool gated on **both** `govapps.delete` **and**
`govapps.edit`. There is no `restore` capability, and restoring is the only
operation that puts content back into public view — so it needs both the right
to have removed something and the right to decide what is visible. See the
comment on `RestoreGovAppTool` if that trade-off should change.

### Governorate scoping (transit only)

Transit capabilities can be restricted to specific governorates via
`permission_scopes.transit`. Two things follow, and both are enforced in
`TransitTool`:

1. **Listings are narrowed, never widened.** The tools pass
   `AgentContext::allowedTransitCities()` straight into a `whereIn`. An explicit
   `city_id` argument intersects with that scope rather than replacing it, and is
   refused outright if it falls outside. Every transit listing returns a `scope`
   field so an agent can tell a narrow result from an empty queue.

2. **Writes guard the resolved target, not the arguments.** Approving draft 91
   acts on whichever governorate that draft lives in, which is a database fact
   and not an input. These tools resolve the draft or route first, then call
   `guardCity()` with the city it actually turned out to be in. Checking earlier
   would mean trusting the caller's claim about where the data is.

Two cases that are easy to get wrong and are covered by tests:

- A **linked edit** touches two governorates — the draft's own, and the live
  route it targets. Both are checked, so an agent scoped to Homs cannot rewrite an
  Aleppo route through a Homs draft.
- A **move** has two ends, and both are checked, so a scoped agent cannot
  relocate a route out of its own governorate.

`AgentContext::allowedTransitCities()` returns `[]` rather than `null` when there
is no authenticated user, so an anonymous context sees no governorates instead of
all of them.

### Tool catalogue

Read tools are advertised directly. Every write and destructive tool sits behind
a `ToolSearch` catalogue, so `tools/list` stays short no matter how many modules
are added — agents pick far more reliably from a short list plus a search than
from a flat wall of forty mutations. Catalogue tools are reached via
`search_tools` → `execute_tools`.

Note that `execute_tools` answers as an SSE stream
(`text/event-stream`, one `data:` line per message) while a direct `tools/call`
answers as JSON. `search_tools` returns its catalogue as a JSON string inside a
single text block, not as `structuredContent`.

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

The same pattern, same three-part shape, now covers three more modules:

| Module | Service | Presenter | Exception |
|---|---|---|---|
| SyOfficial | `Services/SyOfficial/SyOfficialDirectoryService` | `SyOfficialPresenter` | `Exceptions/Directories/DirectoryActionException` |
| Gov Apps | `Services/GovApps/GovAppService` | `GovAppPresenter` | `Exceptions/Directories/DirectoryActionException` |
| Transit | `Services/Transit/TransitAdminService` | `TransitPresenter` | `Exceptions/Transit/TransitActionException` |
| Users | `Services/Users/UserModerationService` | inline in `Mcp/Tools/Users/UsersTool` | `Exceptions/Users/UserModerationException` |

Invariants preserved in the shared layer: only `pending` places can be
moderated; at most 10 photos and at least 1; both photo-count guards run under
a row lock on the place; every change that can alter the map payload forgets the
`places:map` cache.

Each of the three admin controllers is now a thin HTTP adapter that keeps only
its scope checks, its per-route validation, and the exact status codes the
dashboard already depends on. `TransitAdminController::updateRouteStatus`, for
example, answers **200** for "already that status" while every other refusal in
the module answers 4xx — preserved deliberately rather than normalised, because
the admin form treats it as a successful no-op.

### Directory specifics worth knowing

The two directory modules are structurally the same but not identical, and the
differences are load-bearing:

- **Deletes differ.** SyOfficial entities and categories are a **hard** delete.
  Deleting a category cascades to every entity in it, so
  `delete-syofficial-category` reports `entities_deleted` in its response. Gov Apps
  **soft** delete, so a deleted app keeps its id — `create-gov-app` refuses to
  reuse it and points at `restore-gov-app` instead of failing on a driver-level
  unique-key error.
- **Omitted vs explicit null.** `update-syofficial-entity` and `update-gov-app`
  treat an *absent* `socials`/`links` as "leave it alone" and an explicit empty
  array as "clear it". The old controller code conflated the two and wiped the
  column when the field was omitted; the dashboard always submits it, so the
  admin's behaviour is unchanged.
- **`socials` / `links` stay lists.** Both controllers used a bare
  `array_filter()` without reindexing, so dropping an entry left gaps in the key
  sequence. That column is cast to `array`, and a JSON object like
  `{"1":"https://…"}` decodes to non-sequential keys, which breaks a plain
  `.map()` in the Inertia components. The shared service reindexes.
- **Image handling** is one class, `Services/Directories/SquareWebpImageService`.
  The two controllers had near-identical ~50-line GD blocks differing only in
  their path prefix; both now call it, centre-cropping to 200×200 WebP on a
  transparent canvas and falling back to storing the original when GD is missing.

### What is deliberately *not* exposed to agents

`combineRoutes` and `splitRoute` — combining two routes into one, and splitting
one at a stop — are **dashboard-only**. They live in
`Services/Transit/TransitRouteComposer` and are deliberately not registered as
tools:

- they do coordinate-level surgery on route geometry (reading it back out,
  merging or splitting coordinate arrays, and rewriting stop pivots),
- they rewrite several live routes in a single transaction,
- and they have **no test coverage**, because the spatial SQL they need
  (`ST_AsGeoJSON` / `ST_GeomFromGeoJSON`) does not exist on the SQLite test
  database, so a regression would not be caught in CI.

Everything else in the transit module is exposed. For the same reason, no tool
reads coordinates back out of the *spatial* `geometry` columns on `routes` and
`stops`. `get-transit-draft-geometry` does return coordinates, but from
`route_drafts.geojson`, which is a plain JSON column — so a reviewer can see
exactly what was submitted without the MySQL dependency.

That spatial gap is why the test database uses geometry-less fixtures: a draft
with `features: []` and a route with no stops exercise every code path except the
`INSERT ... ST_GeomFromGeoJSON(...)` call itself.

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

`tests/Feature/Agent/`:

| File | Covers |
|---|---|
| `AgentAuthorizationTest.php` | The ceiling: clamping, wildcard refusal, live revocation, governorate scoping, fail-closed paths |
| `AgentHttpTest.php` | The edge: feature flag, guest, session-cookie refusal, ban, expiry, revocation, real bearer round trip |
| `PlacesToolsTest.php` | Tool behaviour, domain refusals, `shouldRegister` gating, audit outcomes, redaction |
| `ApiTokenIssuingTest.php` | Form → token: clamping, banned owners, unknown ids, TTL fallback |
| `DirectoryToolsTest.php` | SyOfficial / Gov Apps: capability isolation, any-of read gates, soft vs hard delete, omitted-vs-null |
| `TransitToolsTest.php` | Governorate scoping, including the two indirect routes (linked edit, move) and cross-module capability isolation |
| `DirectoryDiscoveryTest.php` | The real JSON-RPC surface: `tools/list` gating, `search_tools`, and an `execute_tools` SSE round trip |
| `SetUserBanToolTest.php` | The highest-consequence tool: capability gating, self-ban and superadmin refusals, idempotence, and not leaking the target's permissions |

`tests/Feature/`, alongside the module's own:

| File | Covers |
|---|---|
| `SyOfficialDirectoryTest.php`, `SyOfficialAdminTest.php` | Service rules, then the HTTP contract after the controller was reduced to an adapter |
| `GovAppsServiceTest.php`, `GovAppsAdminTest.php` | Same split, plus the soft-delete id-reuse rule |
| `TransitAdminServiceTest.php` | Approve/reject/status/update/move/delete, cache invalidation, and the two regression tests below |

Two notes for anyone extending this:

- Catalogue tools cannot be driven by the package's `AdminServer::tool(...)`
  helper (it resolves primitives by class name, and `ToolSearch` needs its tools
  injected). Use the `callTool()` helper in `tests/Pest.php`, which invokes
  `handle()` exactly as the MCP `ToolInvoker` does.
- `Response::structured()` returns a `ResponseFactory`, not a `Response`. Tool
  `run()` signatures are `Response|ResponseFactory` for that reason.

### Drive the real surface at least once

`callTool()` skips the transport, which also skips schema serialisation. A
catalogue tool with a bogus JSON-schema call (`->maxLength()` instead of
`->max()`, for instance) passes every direct test and then fails for any real
agent, because the schema is only built when `ToolSearch` renders it. So each
module's discovery test goes over HTTP and exercises `tools/list`,
`search_tools`, and an `execute_tools` round trip.

### Two regression tests worth not deleting

Both came out of extracting the transit service, and both are defects that were
live in production:

- `it republishes a linked route when its edit is approved` — submitting an edit
  against a live route unpublishes it, so the map does not show stale data while
  the edit is reviewed. The *reject* path put it back; the *approve* path did
  not, so accepting an edit left the route permanently `disapproved` and
  invisible to every public user. `rejectDraft()` and `approveDraft()` now both
  restore, and the service docblock says why they must stay symmetric.
- `it refuses an end-stop split without leaving a transaction open` — `splitRoute`
  opened a transaction and then returned its 400 from inside the `try`, without
  committing or rolling back, leaking an open transaction onto the connection for
  the rest of the request. The guard now runs before the transaction opens. The
  assertion compares `DB::transactionLevel()` against the level captured before
  the call, because `RefreshDatabase` already holds one.

---

## 10. Adding a module

1. Extract the module's admin logic into a transport-free service under
   `app/Services/<Module>/`, and point the existing controller at it.
2. Add tools in `app/Mcp/Tools/<Module>/` extending `AuditedTool`, declaring
   `$permissions` (all required) or `$anyPermissions` (any one sufficient — see
   §4).
3. Register them in `app/Mcp/Servers/AdminServer.php` — read tools directly,
   writes inside the `ToolSearch` array.
4. Add tests, including one over the real JSON-RPC surface.

For a governorate-scoped module, extend a tool base that wraps
`AgentContext::allowedTransitCities()` and a `guardCity()` helper rather than
reaching for the user directly, and remember that the city is usually only
knowable **after** resolving the target row.

**Do not** add a parallel permission vocabulary. If a module needs a capability
that does not exist, add it to `PermissionCatalogue` — it is the same list the
Filament user form renders. The one exception is deliberate: a read tool in a
module with no read capability should use `$anyPermissions` rather than
minting a capability that changes what every existing token resolves to.

**Do not** expose an operation you cannot test. If a module's hardest operations
depend on something the test database cannot provide — transit's spatial
functions are the current example — leave them behind the dashboard and say so
in the service docblock and here, rather than shipping them to an autonomous
caller on the strength of "it is the same code path".
