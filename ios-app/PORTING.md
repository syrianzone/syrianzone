# Syrian Zone web to native iOS

Preserve the website's features and data while implementing its interface with React Native, SwiftUI controls, and native iOS services.

## Contract

The source is the Laravel/Inertia React website at `b1da794152dde5824909335d7ced4522b06aa31e`. The target starts from the existing Expo 58, React Native 0.88, React 19.3, TypeScript iOS application. The user's existing instructions establish the source, target, full-section scope, Arabic language, light/dark appearance, iPhone 17 verification, graphics requirements, and unpublished PR drafts. Do not ask again to authorize those choices.

- FR-101: Cover every catalogue section, its child screens, and additional user-facing routes discovered in the route inventory. Match observable actions, calculations, data, persistence, loading, empty, and failure states. Record account and administrative capabilities separately with server-owned permission checks.
- FR-102: Build native screens for first-party functionality. A link or browser wrapper does not establish that the linked first-party feature is ported. Preserve links to external services where linking is itself the website's behavior. Treat desktop-only resources explicitly.

Recipes and Answers are external sibling services in the source catalogue. Their outbound links and the first-party Board recipe/answers widgets are included. This repository does not contain those sibling applications' full implementations; do not claim a native port of an unrelated service from its outbound link. The same rule applies to Codex community, Joory, Jard, News, external games, and desktop browser extensions.
- FR-103: Preserve source graphics, maps, fonts, photographs, card layouts, and diagrams through verified iOS-compatible rendering. Keep light/dark variants, Arabic shaping, contrast, and accessibility. An icon without its section's graphics is incomplete.
- FR-104: Test the complete feature interactions on the standard iPhone 17 simulator and the paired physical iPhone 17 Pro when reachable. The previously installed app is a baseline, not evidence for new sections.
- FR-105: Keep commits local and separated by concern. Prepare a PR title, description, validation, dependencies, and remaining risks per section. Present those drafts in this chat for phone review. Do not push, create, reopen, unarchive, submit, or merge GitHub PRs.
- FR-106: Maintain the whole requested scope across work sessions. Missing APIs, native integrations, assets, authentication, or verification remain incomplete work. Never replace a missing interaction with fabricated success or static data.

## Placement and ownership

| Source | Target | Rule |
| --- | --- | --- |
| `resources/js/Pages/<section>/<file>` | `src/features/<section>/<file>` | Preserve directory and component names where possible. DOM presentation is intentionally reshaped for iOS. |
| `resources/js/Pages/Home.tsx` | `src/features/Home/Index.tsx` | Root owns Home and app-shell integration. |
| Browser-independent rule engines and data | Original source, imported through a documented native adapter | Reuse unchanged algorithms rather than fork them. Run their golden tests and native boundary tests. |
| Browser-dependent domain helpers | `src/features/<section>/model.ts` or `src/platform/<concern>.ts` | Preserve calculation behavior, replace browser storage and lifecycle. |
| `resources/data/*.json` | Shared imports | Keep one source for identifiers, labels, categories, shapes, and terminology. |
| Existing SVG, font, and image assets | `assets/` or native asset registry referencing the original | Conversion must be reproducible and preserve attribution. |
| Section inventories | `parity/<workstream>.json` | Source-derived feature contracts, endpoints, graphics, tests, target paths, and gaps. |
| Section PR text | `parity/pr-drafts/<section>.md` | Local review artifacts only. |

Root owns `App.tsx`, `navigation.ts`, `api.ts`, app state, shared components, package/config files, native adapters, and integration. Workers own assigned feature directories and their tests. A worker requests shared changes instead of editing another worker's files. Only root stages multi-file commits or changes Git branches.

## Shared feature interface

Root supplies these interfaces; workers may write against them before integration, but must flag any missing implementation rather than creating a competing shared layer.

```ts
// src/api.ts: paths without a leading slash are relative to /api/v1/.
api.request<T>(path: string, decode: (json: unknown) => T, options?: {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  params?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown; signal?: AbortSignal; authenticated?: boolean;
}): Promise<T>;
// Public structured Inertia reads. Never a WebView, never an auth substitute.
api.page<T>(path: string, expectedComponent: string, decode: (props: unknown) => T,
  options?: { params?: Record<string, string | number | boolean | null | undefined>; signal?: AbortSignal }): Promise<T>;

// src/platform/features.tsx
interface FeatureScreenProps { readonly params: Readonly<Record<string, string>> }
useFeatureNavigation(): { open(section: string, params?: Record<string, string>): void; back(): void };
// Section components are exported by name and take FeatureScreenProps, or no props.

// src/platform/storage.ts: asynchronous device-local JSON, no bearer credentials.
readDocument<T>(key: string, decode: (json: unknown) => T, fallback: T): Promise<T>;
writeDocument<T>(key: string, value: T): Promise<void>;

// src/platform/links.ts: safe native browser, phone, email, and share actions.
openExternal(url: string): Promise<void>;
openPhone(number: string): Promise<void>;
openEmail(address: string): Promise<void>;
shareText(message: string, url?: string): Promise<void>;

// src/ui/graphics.tsx: explicit native SVG artwork with resolved theme colors.
ProjectIcon({ name, size }: { name: string; size?: number }): React.JSX.Element;
```

Continue reusing existing `Label`, `Heading`, `Section`, `Row`, `Photo`, `SearchField`, `EmptyState`, `RequestStatus`, `AdaptivePanes`, `NativeAction`, `NativeSegmented`, `NativeThemeHost`, `useTheme`, `useResource`, and `MapView`. Existing `api.cities/places/place/transitMap/nearbyStops` remain compatible. Feature adapters own their response validators. Public legacy `/api/...` paths are accepted explicitly by the one client; absolute URLs and path traversal are rejected. For third-party Quran data, use one separately allowlisted provider adapter without bearer credentials.

Public Inertia reads were verified against the live site. Bootstrap its documented `data-page` JSON version from the public root, then send `X-Inertia`, `X-Inertia-Version`, and `X-Requested-With` for structured responses. Missing/stale versions produce 409, so refresh once and retry. Validate component names and payloads, omit credentials for public page reads, and never interpret page markup or execute scripts. Compass, Promises, and Party returned 200 with their actual source props. This is a transport adapter, not permission to treat an existing website screen as a completed native screen.

## Native text input correction

React Native 0.88.1 uses the versioned `patches/react-native@0.88.1.patch` and Expo's supported `buildReactNativeFromSource:true` setting. CI must compile RNCore and its dependencies from source so the patch reaches the executable. Native84 captured UIKit accepting a real second character inside an unnecessary attributed-text echo, then RN ignoring and overwriting it while `comingFromJS` was set. The diagnostic observer is excluded from this correction.

The comparison fix ports open upstream [PR59197](https://github.com/react/react-native/pull/59197) at `a91468ffe62122bc49d964a08b493374f0af4775` and merged [PR59718](https://github.com/react/react-native/pull/59718) at `a9790c7a3424837998c20b907cb1ba0ed8167e8b`, for [issue58904](https://github.com/react/react-native/issues/58904). It accepts matching visible text with UIKit's single-line/default attributes and ignores EventEmitter metadata. Real text and style changes still update. It does not include [PR59198](https://github.com/react/react-native/pull/59198)'s larger edit replay for genuine transformed-value/restyle writes. The actual-source comparison regression is 17 checks; native84 remains a failed reproducer until unchanged plain native Poll/Studio cases pass with the compiled correction.

## Idiom map

| Observed web pattern | Native mapping | Source evidence |
| --- | --- | --- |
| Inertia page and route links | Typed native-stack screen and navigation action | `Pages/Home.tsx`, `Layouts/MainLayout.tsx` |
| Admin-configured navigation | Validated `/api/v1/navigation` catalogue plus bundled fallback | `Lib/siteLinks.ts`, `data/site-modules.json` |
| DOM text, buttons, forms, dialogs | Native Text, Pressable, TextInput, SwiftUI controls, and sheets | `Pages/Home.tsx`, `Home/_components/*` |
| Tailwind variables and dark classes | Central theme tokens and explicit light/dark asset variants | `Lib/projectIcons.tsx`, `data/project-icons.json` |
| Inline SVG and canvas graphics | Native vector drawing with explicit dimensions and resolved colors | `Pages/Population`, `Pages/Compass` |
| CSS playing-card pips and backs | Native text and shapes preserving `PIP_LAYOUTS` | `Domain/games/PlayingCard.tsx`, `Domain/games/cards.ts` |
| `localStorage` and `sessionStorage` | SQLite-backed native storage, preserving schemas and conflict rules | `Home/_lib/*`, `Board/_lib/*` |
| Browser API client | One native HTTPS client with validation, cancellation, timeout, bearer authentication, and visible Arabic failures | `Lib/api.ts`, existing `src/api.ts` |
| Public Inertia-only page props | Prefer a documented JSON API. Otherwise validate a public Inertia protocol JSON response through the same native client, or add an explicit backend transport when unavailable. Never render the page as a replacement native screen. | `HomeController.php`, `ExternalDataController.php`, civic controllers |
| `navigator.geolocation` | Foreground Core Location on user request, plus manual city/coordinate choices | `Domain/location/preference.ts`, existing `src/location.ts` |
| Browser audio and Media Session | One shared native audio owner, interruption handling, background/lock-screen controls, and timed position updates | `Domain/quran`, `Pages/Muslim/_components/AudioPlayer.tsx` |
| Browser fonts | Bundled, licensed OpenType/TrueType fonts verified through native shaping | `public/fonts`, Quran and identity assets |
| Browser URL downloads and sharing | Native files and share sheet; preserve format and filename | `Pages/SyId`, `Pages/Compass`, account/avatar and place uploads |
| Pointer dragging | Native gestures and animation with the same game/layout rules | `Games/_lib/useCardDrag.ts`, Board layout helpers |
| Web timers and listeners | AppState-aware timers and lifecycle cleanup, preserving each source's persistence contract | Board Pomodoro persists durations and resets its running phase on reload. Quran sleep timing survives route changes within the player, not process restarts. |
| Guest rooms and Reverb | Existing room APIs plus native realtime transport and session ownership | Guess Who controller and room source |
| Web account cookies | Existing mobile token exchange, Keychain-backed bearer credentials, and server-authoritative capabilities | `AuthController.php`, `routes/api.php`, `effective_permissions` |

Keep unknown server JSON as `unknown` until decoded. Preserve IDs as supplied, coordinates in native latitude/longitude order, Arabic search folding, and existing API validation. Error paths must be visible and retryable; screen-owned requests and polling stop when inactive. The global audio owner retains its stream, text, and timing requests across navigation while playback remains active. A failed save must not report success or overwrite a valid local document. Board documents retain the v1 `i/d/w/h/c` schema and round-trip unknown widget configuration.

Compass completion automatically submits anonymous aggregate statistics in the source, with a withdrawal token, while account saving is manual. Preserve these distinct behaviors and their consent and deletion controls. Do not replace them with a single save button. Automated tests must use isolated fixtures or a test backend, and must never submit invented political responses, ballots, ratings, messages, submissions, or destructive edits to production.

TM-IOS-002 remains applicable to location. TM-IOS-003 remains applicable to URLs and stored records. New authenticated adapters must not persist bearer credentials in SQLite, send them to sibling/external hosts, infer permissions from role names, or log authentication responses. No credentials belong in the bundle, fixtures, screenshots, or PR drafts.

## Source and test manifest

`parity/file-map.tsv` records source path, source line count, target path, reuse/port kind, and owner. `scripts/parity-status.ts` derives draft-file coverage from that map and the current filesystem. File existence proves only draft coverage, not feature completion. Behavioral completion is separately established by source-derived acceptance cases, checked source tests, native tests, production builds, and observed iPhone flows.

Each inventory feature must identify its source and the evidence needed to validate it. Record unavailable upstream feeds and authentication prerequisites honestly. Existing API 401 responses for a guest are not a missing backend. A live endpoint returning 502 is not permission to replace it with invented data.

## Graphics rules

Resolve SVG CSS classes, `currentColor`, CSS variables, theme colors, aliases, and opacity into explicit native-compatible attributes. No browser stylesheet may be required to render an icon. Preserve map geometry and card pip positions. Do not redraw identity marks with approximate glyphs. Check font formats and redistribution terms before bundling. Quran marker015 has unresolved attribution in the source; resolve that issue or use the documented licensed alternative before shipment.

Use original vector/code-native assets for maps, cards, charts, and icons. Use image generation only when a new raster illustration is actually required. Every section inventory must enumerate its graphics so missing artwork cannot disappear during implementation.

## Review and convergence

Before implementation, reviewers check this map against the source, assuming it is wrong. Resolve findings in the map first. Each ported file receives source-versus-target review without relying on the implementer's explanation. For nontrivial rule ports, obtain two independent reviews. Root records accepted/rejected findings and fixes.

Write meaningful failing behavior tests before new invariants or bug fixes. Port existing source rule tests where applicable. Run strict types, lint, behavior tests, production Hermes export, and native Release builds after integration. Re-run a clean compile/test convergence pass after the final fix. Do not repeat expensive builds without a new change or unresolved concern.

Use `TODO(port): reason` for an unresolved translation and `PERF(port): reason` for an unmeasured performance compromise. All such markers and low-confidence files remain in the work queue. New native presentation files document intentional restructuring with a short `PORT NOTE` when it is not obvious.

Ported files end with a compact source record:

```ts
// PORT STATUS: source resources/js/Pages/Section/Index.tsx; confidence high; todos 0.
```

Confidence records translation confidence, not completed device verification. New infrastructure that has no source counterpart does not need a port trailer.
