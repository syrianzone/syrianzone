# Native account session review

Reviewed on 2026-11-14 against `PORTING.md`, the baseline README, the current native account and transport code, and the website's account/settings routes. This report applies specification, architecture-decision, and threat-model review to the session boundary. It does not establish that Google login works on a device or that all account actions are ported.

## Code finding and fix

The original account bootstrap could apply an old `/user` result after another account was installed. It could also install an old token after a delayed Keychain read. That paired one account's visible identity and permissions with another account's API token.

The current implementation closes both windows:

- `src/platform/restore-session.ts:5` checks ownership before installing a restored token.
- `src/platform/restore-session.ts:9` checks ownership after loading the user. Its failure path also ignores obsolete requests.
- `src/platform/account.tsx:47` gives each effect an independent active flag, in addition to the session generation. An aborted StrictMode effect cannot become current when a later effect sets the shared mounted flag.
- `src/platform/account.tsx:66` rejects sign-in until restoration finishes.
- `src/platform/settings-queue.ts:9` and `:11` check the captured session before sending a queued write and before applying its response.

The two restore regression tests pass. Independent source review found no remaining way for either of those delayed bootstrap results to replace a newer session. The tests exercise the extracted ownership boundary, not a mounted `AccountProvider`, Keychain, or Google callback.

## Specification findings

`PORTING.md:91` maps cookie authentication to Keychain-backed bearer authentication, and `:97` prohibits credential persistence in SQLite, external forwarding, permission inference, and logging. FR-101 and FR-106 cover the feature and failure scope. These statements establish useful boundaries but do not specify session ordering, revocation, or failed credential-storage outcomes.

| Proposed requirement | Required behavior and acceptance case | Current evidence | Remaining evidence |
| --- | --- | --- | --- |
| SR-IOS-001: Session ownership | Given restore A is pending, when session B replaces it or the owning effect is disposed, neither A's token nor A's user result may be applied. Late rejection must not clear B. | `restore-session.ts`, generation and active flag in `account.tsx`, two reorder tests | Mounted-provider StrictMode cleanup and late-rejection test |
| SR-IOS-002: Credential persistence | Login installs the bearer and user only after Keychain confirms storage. Failed storage leaves the previous session intact and shows a retryable failure. Credentials never enter SQLite, logs, screenshots, or fixtures. | `account.tsx:84-87`, SecureStore use, `api.ts:62`, PORTING credential prohibition | Injected Keychain write failure and cancellation tests; device login |
| SR-IOS-003: Session-bound writes | A queued settings request captures the account session. An account change prevents unsent work and prevents an old response from changing the new account. Failure does not poison later saves. | `settings-queue.ts`, two queue tests | In-flight response-after-switch test, rather than only queued-before-switch |
| SR-IOS-004: Credential routing | Bearer credentials are sent only for explicitly authenticated requests to the configured HTTPS origin. Guest game identity never combines with account authentication or crosses the Guess Who route boundary. | `api.ts:53-62`, `page-protocol.ts`, API/provider tests | Native transport redirect behavior and authenticated page coverage |
| SR-IOS-005: Revocation and logout | Define local cleanup for server-revoked credentials, logout 401, network failure, and Keychain deletion failure. A failed revoke must not be reported as a confirmed server logout. | `end-session.ts` and fixtures now cover already-revoked 401, revocation failure and Keychain deletion failure | Native revocation/storage failure verification |
| SR-IOS-006: Server-owned permissions | Account capabilities come from validated `effective_permissions`; role labels never grant local privileges. The server authorizes each write. | `account-model.test.ts`, `useCan`, website `toAuthPayload()` | Permission revocation while an authenticated screen remains mounted |

Suggested addition to `PORTING.md`: adopt the six requirements above and link each to its tests and threats. The shared API example also lacks the implemented `guestSessionId` option and authenticated page-read option. Document those explicit credential modes so feature adapters do not improvise a competing authentication path.

The baseline README explicitly says authentication and writes are outside its slice at line 30. That is historically correct for the baseline, but the current port contract needs an explicit session supplement rather than treating TM-IOS-001 through TM-IOS-003 as coverage of this new boundary.

## Architecture decision review

ADR-IOS-001 is an inline baseline stack decision in the README. The repository's numbered ADRs concern unrelated web infrastructure. No session decision with alternatives, failure semantics, or requirement/threat links was found.

Two focused decision records are missing:

1. **Native account credentials and session ownership.** Record why the existing Google token exchange plus Keychain and explicit bearer requests was chosen over a cookie-based browser session. Record the tradeoffs: separate website/device sessions, token revocation, Keychain availability, OAuth configuration, and no automatic web-cookie sharing. Link SR-IOS-001, 002, 005, 006 and TM-IOS-AUTH-001, 002, 004 below.
2. **Authenticated structured page reads.** Record why selected existing Inertia responses are decoded with explicit bearer authentication while public reads omit credentials. Compare adding resource APIs and sharing browser cookies. Specify expected-component validation, deployment-version handling, no markup execution, and origin/redirect policy. Link SR-IOS-004 and TM-IOS-AUTH-003.

These are backfill recommendations, not newly accepted architectural decisions.

## Threat model review

The baseline model contains API validation, location, URL, and local saved-place boundaries. The native account path adds these elements:

| Element | Data and boundary | Existing coverage |
| --- | --- | --- |
| Person and Google authorization service | Browser authorization code, PKCE verifier, Google ID token | Not represented in baseline model |
| Native account provider | Current account, session generation, asynchronous restore and mutation ownership | Not represented in baseline model |
| iOS Keychain | Sanctum bearer token protected with device-only accessibility | Mentioned by PORTING, no threat entry or failure policy |
| Syrian Zone HTTPS API | Token exchange, user reads, settings writes, token revocation | JSON validation covered; authenticated lifecycle is new |
| Native transport and external providers | Explicit bearer versus public and guest requests | Origin prohibition present, no session threat/test traceability |
| Device-local SQLite | Home preferences and public data; no bearer credential permitted | Covered in principle, credential separation is newly explicit |

| Proposed threat | STRIDE categories | Mitigation and state | Gap |
| --- | --- | --- | --- |
| TM-IOS-AUTH-001: Obsolete asynchronous work replaces the current session | Spoofing, tampering, information disclosure, elevation of privilege | Implemented generation/active guards and two reorder tests, independently reviewed on 2026-11-14. Links SR-IOS-001 and 003 | Mounted-provider and in-flight write switch tests remain |
| TM-IOS-AUTH-002: Partial credential storage or revocation leaves a misleading session | Tampering, information disclosure, denial of service | Partial: login stores before applying; logout fixtures now cover revoked tokens and retryable deletion failures. Links SR-IOS-002 and 005 | Inject failed login Keychain storage; verify native partial-logout recovery |
| TM-IOS-AUTH-003: Bearer or guest credentials reach the wrong endpoint | Information disclosure, spoofing | Explicit authentication, fixed HTTPS origin, route-limited guest ID, public credential omission. Links SR-IOS-004 | Native redirect verification and documented authenticated page contract |
| TM-IOS-AUTH-004: Local role labels grant administrative capabilities | Elevation of privilege, tampering | Validated server permissions and exact membership checks; server remains authoritative. Links SR-IOS-006 | Permission revocation and forbidden-response UI behavior |

The existing baseline has no DREAD scores to validate. This review does not invent numerical scores from unmeasured assumptions. The session-substitution issue was treated as P1 because it could pair another account's identity and settings with the active credential. The remaining documentation and failure-policy gaps are P2 until their missing tests establish a higher-impact path.

Repudiation remains a server responsibility for these writes. Do not add sensitive client request logging to fill that gap. The client should retain user-visible outcomes without logging tokens, Google responses, or private account payloads.

## Verification performed

The following focused command passed: `bun test src/platform/restore-session.test.ts src/platform/settings-queue.test.ts src/platform/account-model.test.ts src/platform/page-protocol.test.ts src/platform/external-protocol.test.ts src/api.test.ts src/features/Home/model.test.ts`.

Result: 23 passing tests, 0 failures, 88 assertions across seven files. No real account login, logout, remote write, simulator operation, or native build was performed for this initial review. The later native broker evidence is recorded in the follow-up below; it does not require a separate Google iOS client.

## Follow-up after root fixes

Independent inspection and the focused follow-up suite confirm the reported Home and logout findings are addressed in current source:

- `end-session.ts` treats a logout 401 as an already-revoked credential, then clears Keychain before memory. A deletion failure remains visible and retryable. The previous SR-IOS-005 current-code gap is resolved; device failure verification remains open.
- `api.ts` now exposes a session generation and rejects delayed authenticated dispatch or response decoding after that generation changes. Feature actions must pass the generation captured before photo picking, dialogs, downloads, or other asynchronous preparation.
- Home hydration now mirrors resolved account links and toggles into the device document, seeds an empty account, and adopts only light/dark account themes. Website-only themes retain native device/system appearance.
- Home search retains the external President game's original destination. Appearance synchronization now follows confirmed local persistence.

The follow-up command covered restore-session, end-session, session-generation, settings-queue, Home hydrate/model, and API tests. It passed 23 tests with 72 assertions across seven files. The additional session documentation, mounted-provider cases, and native Google callback/transport verification remain outstanding as recorded above.

## Private resource ownership follow-up

Actual rendered hook tests now establish that changing a private loader synchronously hides the previous loader's data and error before effects run. They also exercise resource refocus retention, inactive request suppression, abort and late response rejection.

Extraction of shared pagination exposed the same error boundary in `platform/usePages.ts`: its data was loader-keyed but its error string was not. A rendered test reproduced an old private error on the replacement loader's first render. The fix keys the failure by loader identity and reports loading while the new active owner has neither a page nor its own error. The failing test then passed. This closes the cached-error adoption case under TM-IOS-AUTH-001 for both resource hooks; it does not establish native login or authenticated mutation behavior.

## Authoritative denial follow-up

Rendered tests reproduced retained private data after the same loader received HTTP 401 or 403 during refresh. Both resource hooks now clear cached data on those responses. Pagination also invalidates its retained-page marker when loading a later page is denied, so returning to the screen retries instead of treating denied pages as loaded. Temporary network errors keep the same owner's cached content.

The focused resource suite passed 11 tests with 55 assertions after four denial regressions failed against the previous implementation. This establishes the shared hook behavior for SR-IOS-006 and TM-IOS-AUTH-004. Individual editors still need their own ownership guards and controlled-account native checks.

## Google broker follow-up

The earlier project-client access limitation is superseded by the implemented website-mediated native broker. The existing web client and HTTPS callback authenticate Google, followed by a fixed app callback and one-use S256-bound exchange. No separate Google iOS client or production credentials were used. Backend review and focused tests pass. Account-native06 passed synthetic browser consent, callback/PKCE exchange, native account adoption, dashboard access, logout and browser cancellation. This establishes the isolated local handoff, while real Google success and backend rollout remain pending. The completed cohort had five passes (including one cleanup case) and three failures. Account-native07 subsequently passed the campaign administration and popup geometry cases. Account-password-native16 later passed native eligible-administrator login/adoption/dashboard/logout, wrong-password rejection and 429 countdown/disabled controls after bounded local HTTP throttle setup, with successful cleanup and product restoration. Six consecutive native attempts and deep-link panel expansion remain unverified. Detailed protocol and credential-rollback limits remain in native-google-protocol.md.
