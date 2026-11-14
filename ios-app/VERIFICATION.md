# Verification

Recorded on 2026-11-14. Run commands from `ios-app/`.

| Check | Observed result |
| --- | --- |
| `bun run check` | Strict TypeScript, ESLint, and 52 tests passed. Tests made 255 assertions across ten files. |
| `bun audit` | No known dependency vulnerabilities reported. |
| `bunx expo install --check` | Installed versions satisfy Expo SDK 58 compatibility checks. |
| `bunx expo export --platform ios` | Production Hermes bundle generated, approximately 2.4 MB, with React Compiler enabled. |
| `bunx expo prebuild --platform ios --no-install` | Native project generated with Arabic RTL enabled before launch, four orientations, iPhone/iPad targets, and an opaque 1024 px app icon. |
| Native simulator build | Release build passed with Xcode 27.2 and iOS SDK 27.2. The app contains arm64 and x86_64 simulator architectures and is approximately 95 MB. |
| `bun run ios:smoke --device 7BA4D52B-FA55-498B-9C5C-9B7795A06164` | The final Release app launched on the real iPhone Duo profile. Its exact new process remained alive through the ten-second startup check. |
| Selected mutation checks | All ten isolated mutations failed explicit behavioral assertions. This checks selected decoder, search, persistence, map, and layout invariants, rather than exhaustive mutation coverage. |

The tests cover public API decoding and cancellation, local save persistence, Arabic search, location watcher cleanup, map coordinates, simulator selection, and safe layout around folds and occlusions. A production compiler regression test reproduces and prevents the startup crash caused by a component shadowing JavaScript's global `Symbol`. They don't establish native UI correctness.

## Simulator UI checks

The iPhone Duo ran iOS 27.2, build `24B91016s`. Interactive checks covered live transit cities, route selection, fares, stops, and Apple Maps geometry. Selected routes survived folding, unfolding, and rotation. Partially open layouts kept content outside native reserved regions.

Mishwar checks covered Arabic search for `الحجاز`, two live results, place photos and details, a native map, device-local saves, and the share sheet. The share sheet was cancelled without sending anything. A saved place survived app restarts and installation updates. Light and dark switching persisted, including readable status icons and prominent buttons. Maximum accessibility text switched to a scrollable single pane. Normal text size was restored afterward.

All six current iPad families ran the app on iOS 27.2, build `24B8117`:

| Model | Observed result |
| --- | --- |
| iPad mini (A20 Pro) | Light/dark lists, photos, place details, native map, and exact process liveness passed. Rotation preserved the selected place and changed to two panes. |
| iPad Pro 11-inch (M5) | Light/dark core rendering passed. Final Release recheck passed for Arabic alignment, back label, prominent-button contrast, map, photos, two panes, and process liveness. |
| iPad Pro 13-inch (M5) | Light/dark core rendering passed. Final Release recheck passed for Arabic alignment, back label, prominent-button contrast, map, photos, two panes, and process liveness. |
| iPad Air 11-inch (M4) | Light/dark lists, photos, place details, native map, and exact process liveness passed. |
| iPad Air 13-inch (M4) | Light/dark lists, photos, place details, native map, and exact process liveness passed. |
| iPad (A16) | Light/dark lists, photos, place details, native map, and exact process liveness passed. |

The mini, Air, and A16 checks used the Release build after Arabic alignment fixes and before the last prominent-button color change. Both Pro sizes and the Duo received the final contrast-fixed build. The iPad matrix covers launch, routing, and rendering, plus mini rotation. It does not establish control activation on every iPad, arbitrary window sizes, physical-device performance, or battery use. Task-created QA simulators were removed, and the original Duo remains running.

Xcode's Duo boot-status command reported a migration bookkeeping warning even though the app ran. The simulator runner reports that warning and verifies the actual app process instead of treating a boot-status message as proof of startup.

[Duo light screenshot](screenshots/duo-light.png) and [Duo dark screenshot](screenshots/duo-dark.png) show the final Release app. Detailed simulator records and mutation output remain in local verification artifacts.

## Host benchmarks

Measured on an Apple M1 Max with 32 GiB RAM, macOS 27.0.1, and Bun 1.3.11 on ARM64. Each case runs once cold, five warmups, then 30 measured iterations. The generated transit response contains 10,000 route points and 1,000 stops, totaling 410,014 UTF-8 bytes.

| Operation | Cold | Median | p95 |
| --- | ---: | ---: | ---: |
| Decode transit JSON | 8.11 ms | 1.94 ms | 2.54 ms |
| Search 10,000 Arabic names | 48.88 ms | 45.17 ms | 47.56 ms |
| Calculate 1,000 hinge layouts | 6.57 ms | 0.48 ms | 0.62 ms |

These measure host processing. They don't measure iPhone startup, scrolling, frame rate, network latency, or power use. Raw output stays in the ignored `.expo/verification/` directory. Reproduce with `bun run benchmark`.

## Source checks

The stack follows [T3 Code's mobile package](https://github.com/pingdotgg/t3code/blob/629242b8d3ab6f1c626c5098bf932345d7926285/apps/mobile/package.json) at commit `629242b8d3ab6f1c626c5098bf932345d7926285`. Expo SDK 58 patch versions were updated to the compatible versions reported by Expo's installer. Native geometry adapts T3 Code's UIKit observer, with its license retained beside the module.

Public endpoint paths and response shapes were checked against Syrian Zone's existing Flutter app and server controllers. Saved places are device-local snapshots, with no account synchronization. CI action commit IDs were resolved through GitHub's repository API.
