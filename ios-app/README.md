# Syrian Zone for iOS

An Arabic native iOS client for Syrian Zone, built with the React Native, Expo, and SwiftUI stack used by [T3 Code](https://github.com/pingdotgg/t3code/tree/629242b8d3ab6f1c626c5098bf932345d7926285/apps/mobile).

The current work expands the original Transit and Mishwar application to the website's public sections, accounts, and administration. Native screens and source-derived tests are implemented across the catalogue. Full interaction verification is still in progress on the standard iPhone 17. Google sign-in uses the existing website client through a reviewed native handoff, without a separate iOS OAuth client. The new authentication and administration routes require a server release; real Google sign-in remains unverified.

See [the current port contract](PORTING.md), [section inventories and review records](parity/), and [local PR drafts](parity/pr-drafts/). Drafts have not been submitted to GitHub. The original contract and device matrix below describe the baseline; they do not establish verification of the expanded application.

## Baseline contract

- FR-001: Browse the public transit cities, routes, stops, and route geometry from the existing Laravel API. Selecting a route shows only its geometry and stops. Location access is requested only when you ask for nearby stops.
- FR-002: Browse, search, and filter Mishwar places. Open a place's details, photos, native map directions, and the iOS share sheet. Empty, loading, unavailable, and network error states stay visible.
- FR-003: Keep saved places on this device using SQLite. Store appearance on this device. Offer only light and dark, initially matching the system.
- FR-004: Use Arabic product copy, RTL layout, accessible native controls, Dynamic Type, and the system's reduced motion preference. Keep map coordinates and paths in their original order.
- FR-005: Resize for compact phones, iPhone Duo folded and unfolded, and iPad windows. Read native hinge reservations on supported SDKs. Keep controls outside occluded regions, and preserve selections while resizing.
- FR-006: Ship an iOS-only application with pinned dependencies, type checks, lint, behavior tests, a repeatable simulator command, and measured performance evidence. Do not claim device support before running the device matrix.

The baseline covered the two sections on the Flutter application's home screen. The expanded implementation includes account, saved-place synchronization, submission, moderation, and Transit Studio screens under the current port contract.

## Architecture decision

ADR-IOS-001 uses Expo SDK 58, React Native 0.88, TypeScript, React Navigation native stacks, Expo UI SwiftUI controls, and Apple Maps. This follows T3 Code's iOS stack without importing its unrelated agent services or private native navigation fork. Flutter remains unchanged. A separate `ios-app/` package keeps installation and releases independent of the web monolith.

Screens depend on typed domain and API modules. A single HTTPS API client validates server responses, bounds request time, and exposes Arabic errors. API data comes from `/api/v1/transit/*` and `/api/v1/places*`, the same routes the Flutter app calls. SQLite stores device-local preferences and saved place records. Native geometry observations supply window traits and hinge reservations, rather than inferring hardware from screen width.

## Trust boundaries

TM-IOS-001: Treat API JSON as untrusted. Validate coordinates, identifiers, response shape, and URLs before using them in native controls. Malformed data produces a visible error. The app has no embedded credentials.

TM-IOS-002: Location stays on the device except for a nearby-stop request explicitly initiated by you. Denying location keeps city browsing available. There is no background location access.

TM-IOS-003: Open only validated HTTPS image and share URLs. Directions use the operating system's map URL with encoded coordinates. Device-local saved places are separate from account saves, and the UI labels them accordingly.

These boundaries implement FR-001 through FR-005 under ADR-IOS-001. Authentication and write APIs are outside the baseline described here. The current port contract and account review record cover the expanded credential and permission boundaries.

## Development

Run the commands below from `ios-app/`. Xcode must have its license accepted and an iOS simulator runtime installed.

```sh
bun install --frozen-lockfile
bun run check
bun run ios
```

The default command builds a standalone Release app and opens the standard iPhone 17 simulator. It checks the SDK, exact device profile, runtime compatibility, and app startup. It refuses to substitute another model when that profile is unavailable. To install current simulator support first, run `bun run ios --download` after finishing Xcode setup.

You can select Duo or an iPad by its exact Xcode profile name:

```sh
bun run ios --device "iPhone Duo"
bun run ios --device "iPad mini (A20 Pro)"
bun run ios --device "iPad Pro 13-inch (M5)"
```

The API defaults to `https://syrian.zone`. A development override must use HTTPS and can be supplied with `EXPO_PUBLIC_API_ORIGIN`.

## Verification

Tests cover API decoding, request errors, cancellation, route geometry, Arabic search, persisted saves, and resize/hinge layout. See [verification results and benchmarks](VERIFICATION.md) for the checks actually run.
