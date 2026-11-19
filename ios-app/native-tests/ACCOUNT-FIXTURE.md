# Local authenticated native tests

`account-fixture.tsx` is a separate temporary bundle entry. Production `index.ts`, `App.tsx` and navigation do not import it. Root's adapter runner compiles it with the exact origin `https://127.0.0.1:9443` and passes the private proxy gate through a mode 0600 test-runner configuration. XCTest sends that gate in the fixture-only launch fragment. It is not stored in source, bundle constants, HTTP queries or a plaintext backup.

Setup rejects any other compiled origin before touching credentials. A global fetch boundary rejects other HTTP origins before dynamically importing the real App and API singleton. The local proxy provisions a real mobile token; the original `/api/v1/user` must verify the expected seeded ID before the fixture writes that token to its local SecureStore key. The unchanged AccountProvider then restores the same session. Native Google authorization is not covered.

Production keeps its exact legacy Keychain and SQLite names. Nonproduction keys and the SQLite database use the full SHA256 of the canonical HTTPS origin through Expo Crypto. Board, saved places, game documents, preferences, device identity and Guess Who identity share that boundary. The fixture never reads, copies or replaces production credentials.

`LocalFixtureTestCase` is the XCTest base for tests that mutate local accounts, Board or civic state. `launch("member", id: 101)` and `launch("admin", id: 103)` require the local origin and verified identity banner. A modal hides the underlying banner from accessibility, so assert it before opening that modal. Use the normal native screens and client for mutations, with the seeded local IDs only.

Use the shared `open(section, app:)` helper for product navigation. Actual XCTest `app.open` cold-launched the fixture and lost its in-memory launch gate. The helper submits the fixture-only destination field, which emits a validated internal link through Expo Linking in the running process. This control does not exist in the production entry.

`testClearLocalFixtureState` cold-starts `syrianzone://fixture/cleanup` before App mounts. It validates the full nonproduction namespace, deletes its three scoped Keychain entries and clears its scoped SQLite store. It never opens legacy storage. The runner executes this test in `finally`, then restores and launches the product bundle. A cleanup failure is reported separately because isolated test state cannot be adopted by the product bundle.

Boundary tests cover rejected launch origins, duplicate or unknown selectors, header injection, HTTP origin escapes, redirects, malformed sessions and inconsistent storage namespaces. Native profile, photo-picker cancellation, logout, Board synchronization and administration cohorts remain pending until their XCTest results are collected. No production mutation is authorized by these tests.

`NativeGoogleBrokerUITests` uses the real source browser start, session state, PKCE handoff, mobile exchange and AccountProvider with a clearly labeled local simulated upstream provider. It is written to verify native callback adoption and system-browser cancellation. Its evidence cannot establish real Google account verification, consent or production deployment.
