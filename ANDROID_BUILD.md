# DenX Animator Android builds

DenX uses Capacitor to package the existing HTML, CSS, and JavaScript app as an
Android application. The website source remains the source of truth.

## Build with GitHub Actions

1. Open the repository's **Actions** tab.
2. Select **Build DenX Android APK**.
3. Choose **Run workflow** on the `main` branch.
4. Open the completed workflow run.
5. Download `DenX-Animator-v0.6.0-alpha-APK` from **Artifacts**.
6. Extract the ZIP and install the APK on an Android device.

The artifact is a debug-signed test build. It is suitable for device testing,
but it is not the permanent Play Store or public release build.

## Build locally

Requirements: Node.js 22+, Java 21, and an Android SDK.

```bash
npm ci
npm run build:android:debug
```

The APK is written to:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Updating DenX web code

`npm run prepare:web` recreates the ignored `www/` staging directory using the
current DenX pages, scripts, styles, and icons. `npm run sync:android` stages
those files and copies them into the Android application.

## Release signing

Do not commit an Android keystore or its passwords. A permanent release workflow
will be added after the debug APK passes device testing. Every public update must
use the same release signing key.
