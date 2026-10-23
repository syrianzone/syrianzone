# SyrianZone Mobile 2.0

SyrianZone Mobile App

## Status

This project is still **Work In Progress (WIP)**.

The current focus is on:

- **Transit**
- **Mishwar**

APIs, UI flows, and data models may change frequently while these features are being built and stabilized.

## Tech Stack

- Flutter
- Dart

## Project Structure (high level)

- `lib/core`: shared constants, DI, networking, routing, theme, common widgets
- `lib/feature`: feature modules (including transit-related features)
- `android/`, `ios/`: platform-specific configuration

## Prerequisites

Before running the app, make sure you have:

- Flutter SDK installed
- A configured Android SDK and/or Xcode (for iOS)
- A connected device or running emulator/simulator

Recommended checks:

```bash
flutter --version
flutter doctor
```

## Getting Started

From the project root:

```bash
flutter clean
flutter pub get
flutter run
```

## Build

Build a debug APK:

```bash
flutter build apk --debug
```

Build a release APK:

```bash
flutter build apk --release
```

Build an iOS app (macOS only):

```bash
flutter build ios --release
```

## Notes

- Since this is WIP, some screens/features may be incomplete.
- Expect frequent updates in Transit and Mishwar modules.
