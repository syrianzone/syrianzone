# Syrian Zone mobile

The Expo (React Native) port of https://syrian.zone. One codebase, Android first.
Every section on the website has a screen here and talks to the same backend.

## Run

```sh
cd mobile
npm ci
cp .env.example .env        # EXPO_PUBLIC_API_URL=https://syrian.zone
npx expo run:android        # needs Android Studio or the SDK, builds a dev client
```

Node 24 (`.nvmrc`), JDK 17 or 21, Android SDK 36.

## Test

```sh
npm run typecheck           # tsc --noEmit
npm run lint                # eslint, zero warnings allowed
npx jest src/features/Home  # targeted, the full suite takes about 80s
npm test                    # everything
```

Screen tests use @testing-library/react-native 14: `render()` and `fireEvent` are async.

## Build a preview APK

Every push to the `mobile` branch runs `.github/workflows/mobile-android.yml`, which
typechecks, lints, runs jest, and uploads `app-release.apk` as a workflow artifact
(Actions tab, 30 days). The APK is signed with the debug keystore: it installs
anywhere but is not a Play Store upload.

Locally:

```sh
EXPO_NO_GIT_STATUS=1 npx expo prebuild --platform android --no-install
(cd android && ./gradlew assembleRelease)
ls android/app/build/outputs/apk/release/app-release.apk
```

## See it without an emulator

Three options, none of which run an emulator on your Mac:

1. `docs/screenshots/` holds one PNG per screen, captured from a headless emulator
   with `scripts/capture-screenshots.sh app-release.apk`. Open the folder on GitHub.
2. Drag the APK onto https://appetize.io (free tier). The phone runs in their cloud
   and streams to a browser tab.
3. Install the APK on any Android phone: `adb install app-release.apk`, or send the
   file to the phone and open it.

`npx expo start --web` also works for most screens (maps and WebRTC fall back to
placeholders), if you just want to click around in a browser.

## Notifications

Local notifications only, no push server. Two checkers run on a 15 minute
background task (`expo-background-task`) and whenever the app comes to the
foreground: government tier list rank changes, and emergency warnings from the
Ministry of Emergency and Disaster Management via https://news.jard.chat.
Both are off by default; Settings turns them on. Android may delay or skip
background runs on low battery, so the foreground check is the one that always fires.

## Backend dependency

The app calls `/api/mobile/*` for most sections (routes/mobile-*.php). Production
serves only the legacy routes today, so those screens 404 until the backend on this
branch is deployed. `mobile-api.tsv` lists every endpoint and where it is used.
