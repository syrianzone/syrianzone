# Prayer account fixture

`NativePrayerAccountUITests` exercises the shipping Prayer switches and account settings caller against the gated loopback fixture. It marks and unmarks Fajr for member 101, checks a cold reopen, then checks the same flow for Dhuhr on member 102. Each account's native writes must leave the other account's current server settings unchanged.

The website and native app deliberately OR-merge the device log into the next account at login. The case expects the device's explicit false Fajr record to reach account 102. It does not assert a separate device-log namespace for each account.

Version 2 native execution is pending. Source tests, strict TypeScript, lint and the strict Swift SDK check have passed. The earlier version 1 native case failed at the account-102 Home bootstrap; Root restored and closed that journal before this change. This fixture does not prove live provider accuracy, the public date/timezone rollout, foreign locations, midnight rollover or location permissions.

## Run only this case

From `ios-app`, use the existing native runner with a new run tag:

```sh
node scripts/verify-native-adapters.mjs \
  --device "$PRAYER_SIMULATOR_UDID" \
  --team "$PRAYER_TEAM_ID" \
  --run "$PRAYER_RUN_TAG" \
  --fixture account \
  --preserve-prayer-state \
  --only SyrianZoneUITests/NativePrayerAccountUITests/testPrayerNativeMarkColdReopenActiveAccountWritesAndExactRestore
```

The preservation flag is required. The runner accepts only this class or exact method, rejects mixed Studio/Quran modes and reconstructs the compile-time and XCTest flags from the explicit argument. Before creating a run directory or building, it requires an unauthenticated TLS-verified fixture refusal advertising journal protocol 2. The Swift case checks the same version in server replies and local markers. The account fixture requires the matching compile-time mode before minting a session.

In this mode, the outer fixture cleanup closes SQLite without clearing, enumerating or deleting personal values. The case's exact restore path owns its local changes. Default cleanup and Studio preservation keep their existing behavior.

## Preconditions and owned data

Both original server accounts must be the canonical, verified, unbanned local users 101 and 102. The case refuses existing `prayerLog`, `muslimMethod` or `muslimCity` properties before any native write. Member 101 must already have complete, typed values for `theme`, `eventsGovernorate`, `showWeather`, `showPrayerTimes`, `showEvents` and `customLinks`. Member 102 must have either all six properties or none. Other account settings are guarded by a digest and preserved.

At arm, member 101 may use the fresh seed name `مستخدم اختبار محلي` or the existing fixture's verified name `مستخدم تحقق محلي`. Its Google subject may be absent or the exact source fixture subject `local-google-member-101`. Member 102 keeps its exact seed name and absent Google subject. The complete observed identity is then immutable. Switching between accepted initial names or subjects after arm still refuses rollback.

The local fixture store must have manual Damascus selected, method 3 without an explicit method choice, an empty prayer log and no reading-position timestamp that would trigger unrelated account synchronization. Existing history, an unexpected log, another active nonce or incompatible settings cause preflight refusal. A refused preflight revokes only its fresh, verified token before Keychain installation or App import.

The local journal reads only these fixed rows in the origin-derived fixture database:

- `syrian-zone.document.syrian-zone.faith.preferences.v1`
- `syrian-zone.document.home.v1`
- `syrian-zone.appearance.v1`
- `syrian-zone.document.syrian-zone.location.v1`
- `native.fixture.prayer-sync.journal`

The location document is read and hashed. It is never changed. Existing reading-position metadata is guarded and retained. Cleanup restores the exact original bytes and presence of faith, Home and appearance together, then removes the owned journal in the same public SQLite transaction. A changed location, concurrent write or unexpected current value retains the journal and refuses restoration. No other local row is enumerated or changed.

After arm, the gated read-only context exposes only immutable Home hashes, appearance values and the decision to seed account 102. Preflight uses the actual native Home decoder and hydration function against the fresh account profile before App import. Unsupported normalization or unrelated Faith synchronization refuses before a token is installed.

## Synthetic times and real writes

The closed `prayer-sync` launch variant is available only to member 101 and member 102. It substitutes an explicitly labelled HTTP DTO for the exact public loopback Damascus/method-3/current-day prayer-times request. The six fixed clocks come from `tests/Feature/PrayerTimezoneApiTest.php`; the DTO carries the requested day and `Asia/Damascus`. Other requests retain the existing guarded transport. A positive DTO-read marker is required before tracking.

This substitution enables the real controls when the fixture blocks the external times provider. It supplies no production fallback or new calculation engine. All feature writes still originate from the real native Prayer switches through the existing account settings API.

## Exact restoration

The server fixture arms a mode-0600 UUID journal before the first native write. One private owner lock covers the fixed user pair. A second nonce cannot arm that pair concurrently. Requests accept only a nonce, day, fixed action and phase index. They cannot supply settings, user IDs or arbitrary expected values.

The version 2 journal predeclares the initial state, 101 Fajr true/false, 102's Source OR import, and 102 Dhuhr true/false. If account 102's complete initial settings are empty, the third checkpoint also requires the exact initial account-101 Home seed. A nonempty account 102 keeps its existing settings. The pending third checkpoint accepts only the predeclared Prayer-only or Home-only intermediate for recovery; its completed checkpoint requires the full expected state.

Unexpected current fields, history, unrelated settings or identity changes refuse rollback. Restoration compares raw settings and identity in one SQLite transaction, requires one affected row per account and restores only the nine declared fields. Original property absence and SQL NULL versus JSON `[]` or `{}` are preserved. Version 1 journals are refused and never migrated.

The owned app terminates before a cold fixture-only cleanup entry opens. That entry verifies the real version-2 gated server restoration acknowledgement, atomically restores the three local records, and never imports App or mounts account synchronization. Only then can the server journal close. A failed or ambiguous cleanup retains its recovery data. The outer Prayer cleanup preserves it.

## Proxy update, Root only

The source integration does not restart a service. Between native cohorts, after the current cohort has completed cleanup, Root can load the new handler with:

```sh
node scripts/local-fixture.mjs restart-proxy
```

The existing command verifies the proxy owner and command, adopts the existing PHP and Reverb processes, and asserts their PIDs remain unchanged. SQLite, stored assets and PHP/cache state are retained. TLS and the local S3 listener restart with the proxy. Finish any simulated Google browser transaction first because its pending grants live in proxy memory.

Record only `proxyPid`, `phpPid` and `reverbPid` from `.expo/local-fixture/services.json` before and after the command. PHP/Reverb PIDs must match; the proxy PID must change. Do not print `fixture.json`, `access.json`, tokens or launch URLs. Do not run `setup`, `stop`, reseeding or the broad `check` command for this handoff.

An unauthenticated POST with `{}` to `https://127.0.0.1:9443/__native_fixture/prayer-sync` must return 403 with `X-Native-Prayer-Journal-Version: 2` after the reload. The runner checks this before any native preparation. Its probe has a four-second deadline and a 1024-byte response limit, supplies no gate or token and cannot arm a journal or change data. The native run then supplies the private gate through the existing runner.

## Source checks

```sh
bun test ./native-tests/prayer-sync ./native-tests/studio-cleanup.test.ts ./native-tests/account-fixture-model.test.ts ./native-tests/popup-fixture-model.test.ts
php native-tests/prayer-sync/prayer-settings-journal.test.php
node native-tests/prayer-sync/prayer-sync-proxy.test.mjs
node native-tests/prayer-sync/prayer-runner-policy.test.mjs
node native-tests/prayer-sync/prayer-journal-protocol.test.mjs
```

The PHP checks use disposable in-memory SQLite databases and owned temporary journal directories. Local-store checks use disposable real SQLite databases, including competing connections and rollback. The PHP/JavaScript context check exercises Arabic governorate and link text through the actual native decoder. Proxy and protocol checks inject I/O and never contact the running fixture.
