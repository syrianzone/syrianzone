# Users administration fixture

`NativeUsersAdminUITests` uses the real local Users options response. It requires the authoritative administrator flag, actor 103, the source user role, the Transit permission group and a real Damascus city row. It does not supply fabricated city options in the client.

The first native attempt stopped after options in 1.043 seconds because the isolated database had no cities. The administrator, role and permission fields matched the source contract. No native decoder change was needed.

Run `node scripts/local-fixture.mjs prepare-users` from `ios-app/` before this case. The command accepts only the private fixture gate, the exact HTTPS loopback origin, the testing environment and the marked local SQLite database. It inserts the source `StagingTransitSeeder` Damascus geometry, names, zoom and active status only when absent. An existing different row or competing name is an error. It never overwrites a city, reseeds routes, changes users or clears caches. Future fresh fixture seeds call the same helper.

On 2026-11-15, the guarded preparation left one Damascus row. A repeated preparation reported zero inserts and zero other database writes. A freshly provisioned synthetic administrator observer confirmed the real `/api/v1/admin/users/options` response contained `can_manage_users: true`, actor 103, default role `user` and `{id: "damascus", name_ar: "دمشق"}`. Its token was revoked afterward. No credential is recorded here.

`php native-tests/local-server/user-admin-city.test.php` passes 16 pure policy checks, including exact geometry, idempotence and refusal of foreign content or name collisions. PHP syntax and Pint checks pass. A controlled post-bootstrap exception also verified a sanitized refusal and exit status 1, with zero database writes. This establishes the fixture prerequisite, not successful native user creation, editing or deletion. The native case still needs its own rerun.
