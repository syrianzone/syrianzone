# Android TWA (Trusted Web Activity) Setup for Syrian Zone

This directory guides the packaging of the **Syrian Zone** website into a native Android app bundle (`.aab` / `.apk`) using **Google Bubblewrap** (Trusted Web Activity).

Since Syrian Zone is a Laravel + Inertia.js (React) monolith, TWA is the most efficient and robust way to build an Android app. It uses the existing PWA capabilities (Service Worker, Manifest) to deliver an app-like experience with zero duplicate codebase.

---

## 📋 Prerequisites

Before starting, ensure you have the following installed on your development machine:
1. **Node.js** (v16+)
2. **Java Development Kit (JDK)** (JDK 17 or higher)
3. **Android SDK** (Bubblewrap can automatically download and configure this for you during setup if not already installed)
4. **Google Play Developer Account** (Required to publish the app to the Google Play Store)

---

## 🚀 Step-by-Step Setup

### Step 1: Initialize the Project
Initialize a Bubblewrap project by pointing to the production web app manifest. 

Run this command inside the `android` directory:
```bash
npx @bubblewrap/cli init --manifest=https://syrian.zone/manifest.json
```

**During initialization, you will be prompted for several details:**
* **Application name / Short name:** Fetched automatically from the manifest.
* **Package ID:** Change this to your desired package name (e.g., `zone.syrian.app`).
* **Display Mode:** `standalone` (or `fullscreen` if preferred).
* **Signing Key (Keystore):** Bubblewrap will ask if you want to generate a new signing key. Select **Yes**, and enter a password. **Keep this keystore and password safe!** It is required for all future updates.

### Step 2: Build the App
Once initialized, compile your app bundle:
```bash
npx @bubblewrap/cli build
```
This command compiles the Android project and outputs:
* `app-release-bundle.aab`: The file to upload to the Google Play Console.
* `app-release-signed.apk`: A signed APK that you can install directly on a device for testing.

### Step 3: Configure Digital Asset Links (TWA Verification)
To remove the Chrome browser URL bar from showing in your app (making it look like a fully native app), you must verify ownership of the website:

1. During the build or keystore creation, Bubblewrap will output your **SHA-256 fingerprint** (looks like `AB:CD:EF:01:02...`).
2. Alternatively, extract it using `keytool`:
   ```bash
   keytool -list -v -keystore android.keystore -alias android
   ```
3. Open `public/.well-known/assetlinks.json` in your Laravel repository:
   ```json
   [
     {
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
         "namespace": "android_app",
         "package_name": "zone.syrian.app",
         "sha256_cert_fingerprints": [
           "YOUR_SHA256_FINGERPRINT_HERE"
         ]
       }
     }
   ]
   ```
4. Replace `"YOUR_SHA256_FINGERPRINT_HERE"` with the SHA-256 fingerprint of your signing key (all uppercase, colons included).
5. Deploy the updated `assetlinks.json` file to production.

---

## 📱 Testing Locally

To test the TWA app on a connected Android device or emulator:
1. Enable **Developer Options** and **USB Debugging** on the device.
2. Run:
   ```bash
   npx @bubblewrap/cli install
   ```
3. Open the app on your phone. The browser URL bar should **not** be visible. If it is visible, double check that:
   * The `assetlinks.json` file is accessible at `https://syrian.zone/.well-known/assetlinks.json`.
   * The SHA-256 fingerprint in the file matches your signing key.
   * The Package ID matches your app's package name.

---

## 📦 Publishing to Google Play Store

1. Log into your [Google Play Console](https://play.google.com/console).
2. Create a new app and set up your store listing.
3. Upload the generated `app-release-bundle.aab` to your production or testing release track.
