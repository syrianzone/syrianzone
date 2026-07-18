# Syrian Zone web to React Native porting guide

The port keeps Laravel as the network and data layer, then reproduces every Syrian Zone user flow in an Expo SDK 57 React Native client for Android and iOS.

Read this whole document before changing mobile code. A draft must preserve behavior before it tries to polish native presentation.

## Ground rules

- File placement: `resources/js/Pages/<Feature>/<path>` maps to `mobile/src/features/<Feature>/<path>`, preserving the full top-level feature name and nested path. `resources/js/Pages/Home.tsx` maps to `mobile/src/features/Home.tsx`.
- Shared source files preserve their remaining path: `resources/js/Components/<path>` maps to `mobile/src/components/<path>`, `Contexts/<path>` maps to `mobile/src/contexts/<path>`, and `Lib/<path>` maps to `mobile/src/lib/ported/<path>`. Named exclusions below map to one shared native primitive instead of an empty placeholder.
- `resources/js/Data/<path>` maps to `mobile/src/data/<path>`. A manifest `.json` or `.md` source becomes a typed `.ts` module with the same basename, so strict data syntax never receives comments. `resources/js/echo.js` is the only startup special case and maps to `mobile/src/lib/realtime.ts`.
- Exact shared-code specials are `Components/Navbar.tsx` to `mobile/src/components/shell/Navbar.tsx`, `Components/ThemeToggle.tsx` to `mobile/src/components/shell/ThemeToggle.tsx`, `Components/ConditionalLayout.tsx` to `mobile/src/components/shell/ConditionalLayout.tsx`, `Lib/axios.ts` to `mobile/src/lib/api/client.ts`, and `Lib/uploadthing.ts` to `mobile/src/lib/api/uploads.ts`.
- An intentional native split may give one source file several target files. Every target repeats the same source path and line count in its `PORT STATUS` trailer, and the contract verifier derives the exact target set from those trailers.
- Keep exported type and function names in camelCase or PascalCase. Preserve API field names exactly at the network boundary.
- Don't import Inertia, React DOM, Radix, Tailwind, CSS, browser globals, or the web map libraries into mobile code.
- Flag over guess: use `TODO(port): <reason>`, `PERF(port): <source idiom>`, or `PORT NOTE: <why>` when a translation isn't settled.
- Arabic is the default language. Every screen must handle RTL text without reversing geographic coordinates, chart axes, numeric identifiers, URLs, or ordered API payloads.
- `EXPO_PUBLIC_API_URL` is the only server origin. API code owns URL joining, timeout behavior, JSON validation, and human-readable failures.
- A stable random installation identifier lives in secure native storage and is reused for poll cooldowns. Never derive it from advertising, hardware, or account identifiers. Laravel must enforce one accepted ballot per poll, vote day, and hashed installation identifier.
- Native code requests location only at the action that needs it. A denial must leave the rest of the screen usable.
- Android and iOS share behavior. Platform branches are limited to permissions, store links, system sharing, maps, and OS presentation details.
- Mobile bearer tokens carry no authority by themselves. Every protected endpoint enforces the same `admin`, `transit_admin`, or `superadmin` role gate as its web counterpart.
- Google login uses the system browser and a single-use callback code. The app exchanges that code for a revocable Sanctum token, stores it in secure storage, and never copies browser cookies.
- Google login uses PKCE. The app creates the verifier, challenge, and random state nonce; the server binds them to one login transaction; the app checks state on the deep link; and exchange fails unless the verifier matches.
- Guess Who sessions are server-issued opaque credentials. A public session endpoint issues an unbound credential; create or join transactionally binds it to one room and player slot. Signal, presence auth, reconnect, and room reads reject a credential that isn't bound to that room. TURN credentials are short-lived.

## Source and target versions

| Layer | Source | Target |
|---|---|---|
| Server | Laravel 11 baseline | Laravel 12.64.0 under the `^12.61` constraint |
| View runtime | React 19.2.6 with Inertia 2.3 | React 19.2.3 with React Native 0.86.0 |
| Native framework | No native client | Expo SDK 57.0.6 with Expo Router 57.0.6 |
| Web build | Vite 6.4 | Vite 6.4 for the retained web client, Expo CLI for native bundles |
| Node baseline | Local Node 25.6.1 | Node 24 LTS, with Node 22.13 or newer also supported |
| Android | Bubblewrap TWA | Native Android 7+ (API 24), compile and target SDK 36 |
| iOS | None | Native iOS 16.4+, verified with Xcode 26.6 |
| Package manager | npm at the repository root | npm with an exact lockfile under `mobile/` |

## Module map

| Source area | Target area | Notes |
|---|---|---|
| `resources/js/Pages/Home.tsx` | `mobile/src/features/Home.tsx` | Clock, calendar, weather, prayer times, events, search, quick links, and settings stay native. |
| `Pages/SyOfficial`, `Phonebook`, `Sites`, `Party`, `GovApps` | Matching feature folders plus `mobile/src/components/directory/` | One searchable directory shell renders each preserved feature path and typed record contract. |
| `Pages/Polls`, `TierList`, `Components/poll` | Matching feature and component folders | Preserve tier assignment, cooldown, submission, results, history, sharing, and archived filters. |
| `Pages/Compass`, `Alignment`, `Priorities` | Matching folders under `mobile/src/features/` | Keep question order, scoring, result labels, custom alignment, and share output. |
| `Pages/Transit` | `mobile/src/features/Transit/` | Use `@maplibre/maplibre-react-native@11.3.6`. Preserve city, route, stop, nearby, search, studio, and review flows. |
| `Pages/Population` | `mobile/src/features/Population/` | Use `@maplibre/maplibre-react-native@11.3.6` and keep layer, source, legend, city, climate, and rainfall behavior. |
| `Pages/Places` | `mobile/src/features/Places/` | Keep map, list, search, nearby, detail, photo submission, saves, likes, comments, reports, personal lists, and admin moderation. |
| `Pages/GuessWho` | `mobile/src/features/GuessWho/` | Keep room creation, join, signaling, presence, selection, guessing, reconnect, and end-game states. |
| `Pages/SyId`, `Justice`, `House`, `Roznama` | Matching folders under `mobile/src/features/` | Keep images, filters, timelines, event detail, downloads, and external sources. |
| `Pages/SyrianContributors`, `Dashboard`, `Admin`, `Transit/admin` | Matching feature folders plus `mobile/src/components/admin/` | Contributors keep the daily, monthly, yearly, and total count contract. Native auth and role gates replace browser session assumptions. |
| `Pages/Shawarma`, `Privacy`, `Terms` | Matching feature folders plus `mobile/src/components/content/` | Preserve text, attribution, legal headings, and source links. |
| `Components/Navbar.tsx`, `ThemeToggle.tsx`, `ConditionalLayout.tsx` | Exact files under `mobile/src/components/shell/` | Expo Router drawer, header, language, theme, safe areas, and offline status. |
| `Lib/axios.ts` | `mobile/src/lib/api/client.ts` | One typed client with a configured origin, abort timeout, auth token, and error translation. Direct-fetch source files keep their feature target and delegate requests to this client. |
| `Lib/uploadthing.ts` | `mobile/src/lib/api/uploads.ts` | Replace the browser-only UploadThing helper with the role-gated candidate upload contract in `mobile-api.tsv`. |
| `localStorage` and `sessionStorage` | `mobile/src/lib/storage/` | Async storage for preferences, secure storage for tokens and device identity, memory for tab-only state. |
| `public/` | `mobile/assets` or server asset URLs | Follow `mobile-assets.tsv`. Bundle app identity, required fonts, transit fallback data, and the shared province boundary. Keep SyID, official-account, government-app, justice, and tier-list media on Laravel. |

Fallback rule: a source file without a named special case keeps its complete source-relative path under the mapped target root. The only extension rewrite is the `.json` or `.md` to `.ts` data-module rule above. This rule is mechanical and can't merge two source files into one target.

## Type map

| Source type or contract | Native target | Notes |
|---|---|---|
| Inertia page props | Validated API response | Screen state never depends on HTML or Inertia page JSON. |
| DOM event | React Native gesture or change event | Pass domain values through handlers instead of synthetic events. |
| CSS color variable | Theme token | Tokens cover system, light, dark, dark blue, dark purple, dark green, high contrast, Damascus rose, and jasmine. |
| `localStorage` string | Typed storage adapter | Parse and validate at the adapter boundary. |
| `Blob` and object URL | FileSystem file URI | Share or save through native system APIs. |
| `HTMLCanvasElement` | Captured native view or generated SVG | Keep exported content and attribution, not DOM rendering details. |
| GeoJSON longitude and latitude tuple | Readonly `[number, number]` | Coordinate order stays longitude then latitude in API and geometry code. |
| MapLibre or Leaflet map object | Native map ref | Feature state belongs in React and stores, not in the map instance. |
| Browser cookie session | Single-use OAuth code and Sanctum token | Token abilities identify the mobile client. Server middleware still checks the stored user role. |
| `window.crypto.randomUUID()` | `expo-crypto` random UUID | Persist the poll device identifier once. |

## Idiom map

| Source pattern | Target pattern |
|---|---|
| Inertia `Link` or `router.visit()` | Expo Router `Link`, `push`, or `replace` |
| `<a target="_blank">` or `window.open()` | Validate the scheme, then use `Linking.openURL()` |
| `document.title` and `<Head>` | Static or derived Expo Router screen options |
| `window.matchMedia()` | `useColorScheme()` and responsive layout hooks |
| `localStorage` event sync | Context state plus storage subscription owned by the adapter |
| `navigator.geolocation` | `expo-location` foreground permission and watch APIs |
| `navigator.clipboard` | `expo-clipboard` |
| `html2canvas` download | Native view capture, file write, and share sheet |
| `marked` plus `dangerouslySetInnerHTML` | Bundled About Markdown parsed into an allowlisted native token model with safe link handling and no runtime Markdown dependency |
| `<input type="file">` | Expo image or document picker |
| MapLibre source and layer mutation | Declarative native sources, shapes, markers, and polylines |
| Leaflet tooltip HTML | Native callout or bottom sheet built from typed data |
| CSS media query | Window dimensions and platform-specific style entries |
| `fetch()` without cancellation | API client with an abort timeout and typed result |
| Browser online event | Network state subscription with cached last-good data |
| WebSocket or Laravel Echo presence | Native-compatible Reverb client with explicit reconnect state and room-bound subscription auth |
| Browser WebRTC globals and data channel | `react-native-webrtc@124.0.7` data-only peer adapter in a native development build |
| `btoa()` and `atob()` for SDP | `js-base64@3.9.1` UTF-8-safe encode and decode helpers |
| Chart.js, Recharts, or hand-written browser SVG | Feature-owned `react-native-svg@15.15.4` charts with native labels, legends, and share capture |
| JSZip, Blob, and object URL archive download | `jszip@3.10.1` base64 archive in the Expo cache, then native share and guaranteed cleanup |
| Drag and drop | Gesture handler plus Reanimated position state |
| Form submit and CSRF cookie | Validated JSON, or multipart only for declared uploads, with bearer token when auth is required |

## Errors

Network functions return a typed result or throw `ApiError`, which carries status, code, safe message, and optional validation fields. Screens show retry actions for timeouts and server failures, field messages for validation errors, and sign-in actions for 401 responses. Offline-capable screens keep their last valid data and label it as cached.

Never show raw HTML, stack traces, SQL messages, tokens, or third-party response bodies. Logging may include the route name and status but not credentials, device identifiers, vote payloads, or personal data.

## Strings and memory

Global UI strings live in typed Arabic and English dictionaries. The official-accounts feature also keeps its Turkish and Kurdish translations. Arabic remains the fallback when a translation is absent. Server text is treated as Unicode and rendered directly unless a source field is documented as Markdown.

The theme registry keeps system, light, dark, dark blue, dark purple, dark green, high contrast, Damascus rose, and jasmine. A theme token may simplify a web gradient, but it must preserve contrast, dark or light behavior, and the source accent color.

Typography is bundled, not fetched at runtime. `@expo-google-fonts/ibm-plex-sans-arabic@0.4.2` supplies weights 400, 500, 600, and 700 as the default family. `@expo-google-fonts/cairo@0.4.2` supplies weights 400, 600, and 700 for preserved Cairo treatments. Both font packages carry MIT package code and OFL 1.1 font licenses. The app retains their license files, loads the exact native TTF assets through `expo-font`, and uses the platform sans family only while loading or after a reported load failure.

Large GeoJSON, climate reports, event feeds, and image galleries stay out of long-lived global state. Screens cache bounded API responses and release transient map or export buffers after use. File exports write to the app cache and are removed after the share operation finishes.

The About screen imports the bundled `about.md` content through its typed data module. `mobile/src/lib/content/aboutMarkdown.ts` normalizes line endings, recognizes `# ` as H1, `## ` as H2, both `- ` and `* ` as unordered-list markers, and other nonblank runs as paragraphs. A nonblank unmarked line immediately following a list item, with no intervening blank line, becomes a continuation line inside that item. This preserves the BrandKit sentence on source line 32. Blank lines close the active paragraph or list. The inline parser composes bold and links recursively, including bold inside a link label, and emits typed text, bold, and link spans. Unmatched delimiters, malformed links, unsupported markers, and raw HTML remain literal text. Native `Text` and `View` render the tokens, and link presses use the shared scheme allowlist. Golden tests snapshot every block and inline token from the exact bundled document. Tier Board keeps individual image sharing and the complete archive action. It downloads bounded image responses through the API client, adds them to `jszip@3.10.1`, generates base64, writes one temporary zip with `expo-file-system@57.0.1`, opens `expo-sharing@57.0.5`, and deletes every temporary image and archive in `finally`, including cancel and error paths. Archive generation rejects an entry or total size over the tested limits with a clear retry message instead of exhausting memory.

## Cross-file analysis

`mobile-api.tsv` records every first-party data route and direct service dependency with its server implementation, native client, auth mode, required role, and port status. `implemented` means the registered Laravel route and native client evidence both exist. `server-only` marks a registered first-party route that no native client calls. Test results belong to the verification runs below instead of a hand-maintained row status. External rows distinguish direct native calls, server-only upstream calls, and map resources declared in a bundled style. User-initiated external links and media URLs returned by validated payloads aren't service calls, so they stay outside this table. Treat the table as the source of truth before adding a request. A missing first-party contract must be added to Laravel and tested there before the native screen calls it.

`mobile-assets.tsv` records each asset family, whether it ships in the binary or stays server-hosted, and the source and target paths that prove it's used. It covers `public/assets`, `public/syid-assets`, `public/syofficial-assets`, transit and population GeoJSON, root SVG files, fonts, contributor data, and uploaded media.

Offline scope is explicit: the shell, legal text, static civic questionnaires, app identity, bundled map boundaries, persisted widget data, and in-memory last-good API responses remain usable. Server-hosted images use the native disk cache where the screen declares it, then show their fallback when unavailable. The port does not promise a full offline mirror of the 184 MB public tree.

`port-manifest.tsv` lists source files that carry behavior or data into the app. Its order is leaf-first where practical. Pending work is any manifest source without a matching target trailer. `mobile/scripts/verify-port-contract.mjs` checks the source line counts when a source snapshot is available, derives every exact target path from its trailer, and rejects missing, stale, low-confidence, or flagged targets.

The Places source arrived as untracked files in the source checkout, so those files aren't present on the mobile branch. Their paths and line counts remain in the manifest. Set `PORT_SOURCE_ROOT` to a checkout that contains the snapshot when you want the verifier to recheck those source counts. Target existence, trailer counts, confidence, and port flags are always checked.

## Don't translate

- `resources/js/Components/sycn/` and `resources/js/Components/ui/`: replace them with a small native component set.
- CSS files, Tailwind classes, Radix composition, HTML metadata, and Vite chunk boundaries: preserve their visible behavior through native styles and routing.
- `resources/js/app.tsx`, `bootstrap.js`, and Inertia layouts: Expo owns startup, bundling, linking, and update boundaries. Translate the Reverb connection, transport, timeout, auth endpoint, and session-header behavior from `echo.js` into the native realtime adapter.
- `resources/js/Lib/arcjet.ts`: it's an unused Next.js server artifact. Laravel middleware and endpoint-specific rate limits own mobile API protection.
- Browser map objects, DOM export internals, object URLs, and custom scrollbar rules: use native maps, capture, files, and scrolling.
- Google S2 favicon requests in Sites and Government Apps: use the first-party image when available, then a bundled native globe or app placeholder. Don't send browsing domains to the favicon service.
- Generated build output under `public/build`, legacy untracked `frontend/` and `backend/`, dependency folders, caches, and local environment files.
- Population aggregation scripts, raw CSV, and generated environmental reports: Laravel's seeded database and JSON APIs own that data at runtime.
- The root `android/` Bubblewrap wrapper: remove it after the React Native Android build replaces its purpose.

## Verification contract

- `node mobile/scripts/verify-port-contract.mjs` must pass. Set `PORT_SOURCE_ROOT=/path/to/source-checkout` when the Places source snapshot is outside this branch.
- At the repository root, `composer validate --strict`, `composer audit --locked`, `php artisan test`, and `npm run build` must pass.
- Under `mobile/`, `npm audit --omit=dev` and `npx expo install --check` must pass. Run `npm run lint`, `npm run typecheck`, `npm test -- --runInBand`, `npm run doctor`, and `npm run export` twice.
- Run two native cycles. Each cycle starts with `npm run prebuild:clean`, then runs `npm run build:ios` and `npm run build:android` against the fresh generated projects.
- Android builds and Maestro use JDK 17. On this Homebrew host, use `JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"`; other hosts must point `JAVA_HOME` at their JDK 17 installation.
- `npm run smoke:ios` and `npm run smoke:android` must drive every top-level module on an iOS simulator and Android emulator.
- `rg -n 'TODO\(port\)|PERF\(port\)|confidence: (low|medium)' mobile app routes tests` must find nothing unless this guide records a specific accepted deferral.

Node 24 is the release verification runtime. When the active shell uses another Node version, prefix native commands with `mise exec node@24.18.0 --` or use another version manager that selects Node 24.

`@maplibre/maplibre-react-native@11.3.6` is the selected native map because it supports React Native 0.80+, the required new architecture, GeoJSON shape sources, line layers, symbols, map presses, and both target platforms. Transit Studio owns edit state in React: map presses add coordinates or stops, drag gestures edit selected points, and declarative layers render active, reference, and conflict geometry. Undo, conflict checks, stop ordering, and GeoJSON export are pure functions with characterization tests.

The app bundles the dark transit style JSON, including its plain dark background, and keeps CARTO raster tiles and MapLibre demo glyphs as declared remote dependencies. Transit and Places display OpenStreetMap and CARTO attribution because they use those tiles. Population and Syrian identity maps use bundled geometry on a local background. Remote base tiles are not part of the offline promise. If they are unavailable, the dark background, bundled boundaries, cached routes and stops, and an offline notice remain visible.

Charts use `react-native-svg@15.15.4` inside the feature that owns each chart. House charts live in `mobile/src/features/House/HouseCharts.tsx`, Priorities uses `mobile/src/features/Priorities/RadarChart.tsx`, and poll history uses the poll and tier-list `TimeseriesChart.tsx` files plus `mobile/src/components/poll/MonthlyLineChart.tsx`. Their models preserve source scales, labels, legends, RTL text, empty states, and theme colors. Share output uses the Expo SDK 57 compatible `react-native-view-shot@5.1.0` where a rendered native view must become an image.

Guess Who uses `react-native-webrtc@124.0.7`, autolinked by clean Expo prebuild, and a repository config plugin at `mobile/plugins/withDataChannelWebRtc.js`. The plugin adds only data-channel network and release keep settings. It does not add camera or microphone permissions. Expo Go is unsupported, so all Guess Who runs use a native development or release build. SDP uses `js-base64@3.9.1` instead of browser globals. One peer generation may exist per room: stale signals and ICE are ignored by generation, ICE waits for a remote description, the channel is ordered and reliable, and every room change, sign-out, terminal game state, background transition, or unmount removes handlers, closes the data channel and peer, clears queued ICE, and nulls refs. Returning active requests a fresh room snapshot, then retries negotiation after 1, 2, and 4 seconds before showing a manual reconnect action. TURN credentials always come from the short-lived server endpoint.

## Source test caveat and characterization plan

This remains a high-risk port because the source frontend has no JavaScript test suite. Laravel tests cover server behavior, but they do not prove visible React behavior. Target unit, integration, and Maestro tests therefore use source-derived fixtures and observable assertions.

- Home fixtures freeze clock, calendar, weather, prayer, and event inputs, then assert search, settings, quick links, loading, cached, and error states.
- Directory fixtures cover official accounts in four languages, phonebook, sites, parties, government apps, contributors, and Shawarma search, filters, ranking, images, and source links.
- Poll and civic fixtures cover tier moves, ballot payloads, cooldowns, leaderboard series, question order, scoring, result labels, custom alignment, and shared output.
- Transit and population fixtures cover longitude and latitude order, city and route selection, nearby search, map layers, legends, colors, studio edit, undo, conflict, export, and review decisions.
- Places fixtures cover map and list parity, categories, search, nearby distance, detail permissions, multipart photos, likes, saves, comments, reports, personal lists, and moderation transitions.
- Guess Who fixtures cover create, join, slot binding, signaling authorization, presence, character selection, guessing, reconnect, and terminal room states.
- Reference fixtures cover Syrian identity, justice, House modes and provinces, Roznama events, filtering, timelines, downloads, external sources, and cached failures.
- Account fixtures cover sign-in callback validation, token lifecycle, profile updates, deletion, uploads, and every admin, transit admin, and superadmin role denial or success path.
- Content fixtures assert the complete privacy, terms, attribution, and informational heading structure, plus navigation and offline presentation.

Source-derived fixtures live beside their feature tests or under `mobile/src/test/fixtures/`. They never call the network. Laravel feature tests own every first-party route contract, while Maestro journeys own top-level native navigation on both platforms.

## Output format

End every directly ported TypeScript target file with this trailer comment. The typed data-module rule means every manifest target can carry it without invalid syntax:

    /*
    PORT STATUS
      source:     <path> (<N> lines)
      confidence: high | medium | low
      todos:      <count of TODO(port) markers>
      notes:      <one line: anything the build phase needs to know>
    */

Low confidence means the logic needs a source reread. Medium confidence means types or native integration need work but the behavior is mapped. High confidence means build and tests are the remaining judges.
