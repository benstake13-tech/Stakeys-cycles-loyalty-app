# Native apps (Android & iOS)

The staff terminal ships as a web app and, from the same codebase, as native
Android and iOS apps via [Capacitor](https://capacitorjs.com). Capacitor wraps
the built `dist/` in a WebView shell and exposes native APIs (Bluetooth LE,
camera) through plugins.

Everything native is generated from one source of truth:

- `capacitor.config.json` — app id, name, bundled web dir, and the WebView
  origin. The WebView is served under `www.stakeys-cycles.co.uk` so the app's
  relative `/api/*` calls keep resolving to the real Vercel backend.
- `src/utils/bleHost.ts` — adapts the Capacitor Bluetooth LE plugin to the same
  `BluetoothHost` interface the web build uses with `navigator.bluetooth`. The
  e-scooter protocol engine and UI are shared verbatim; only the transport
  differs.
- `android/` and `ios/` — the checked-in native projects. **Generated artifacts
  inside them (copied web assets, `Pods/`, `build/`, `local.properties`) are
  git-ignored** — see each platform's own `.gitignore`.

## Android

Requirements: JDK 21, Android SDK (platform 34, build-tools 34.0.0). Point
`android/local.properties` at the SDK (`sdk.dir=...`) or set `ANDROID_HOME`.

```bash
npm run android:apk      # build web + sync + assemble a debug APK
npm run android:bundle   # release App Bundle (.aab) for Play
npm run android:open     # open the project in Android Studio
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

The debug APK is signed with the debug keystore and is installable via
`adb install`. For distribution, create a release keystore and configure a
`signingConfig` in `android/app/build.gradle` before running `android:bundle`.

Permissions are declared in `android/app/src/main/AndroidManifest.xml`:
`BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT` (API 31+, `neverForLocation`), the legacy
`BLUETOOTH`/`BLUETOOTH_ADMIN`/`ACCESS_FINE_LOCATION` pair (API ≤ 30), `CAMERA`
for QR scanning, and `POST_NOTIFICATIONS` for OneSignal push.

## iOS

Requirements: **macOS with Xcode and CocoaPods.** The iOS app cannot be built
on Linux or Windows — the toolchain (`xcodebuild`, the iOS SDK) is
macOS-only. The project is scaffolded and checked in; build it on a Mac:

```bash
npm run ios:sync         # build web + copy assets into the Xcode project
cd ios/App && pod install
npm run ios:open         # opens Xcode; select a team and Run
```

Or, after `pod install`, from the command line:

```bash
cd ios/App && xcodebuild -workspace App.xcworkspace -scheme App \
  -configuration Debug -sdk iphonesimulator
```

Permission usage strings live in `ios/App/App/Info.plist`:
`NSBluetoothAlwaysUsageDescription`, `NSBluetoothPeripheralUsageDescription`,
and `NSCameraUsageDescription`. iOS requires these or the app crashes the first
time it touches Bluetooth or the camera.

## Bluetooth LE

On Android and iOS the WebView has no Web Bluetooth, so the diagnostic bench
falls back to the native plugin. `EscooterDiagnosticTile` resolves its
transport in order: injected host (tests) → `navigator.bluetooth` (web) →
`createNativeBluetoothHost()` (native). The plugin is imported dynamically and
only initialises when `Capacitor.isNativePlatform()` is true, so the browser
bundle and the test suite never load it.

## Branching / parity

This repo deploys three branches (`staff-terminal`, `customer-app`,
`main-website`) that must stay byte-identical apart from `src/config/surface.ts`
and keep a linear, cherry-picked history. The native projects are ordinary
tracked files and must follow the same rule: make a change once on
`staff-terminal`, then cherry-pick it onto the other two. Never commit the
generated web assets under `android/app/src/main/assets/public/` or
`ios/App/App/public/` — they are per-surface build output and would break
`npm run check:parity`.
