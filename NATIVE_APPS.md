# Native apps (Android & iOS)

The staff terminal ships as a web app and, from the same codebase, as native
Android and iOS apps via [Capacitor](https://capacitorjs.com). Capacitor wraps
the built `dist/` in a WebView shell and exposes native APIs (Bluetooth LE,
camera) through plugins.

Everything native is generated from one source of truth:

- `capacitor.config.json` ŌĆö app id, name, bundled web dir, and the plugin
  config. The WebView serves the bundled assets from a **local** origin
  (`https://localhost` on Android); the app's own backend is reached by an
  absolute origin instead (see ŌĆ£API accessŌĆØ below).
- `src/utils/apiBase.ts` ŌĆö resolves `/api/*` calls to the deployed backend.
  Every `/api/*` call site wraps its path in `apiUrl(...)`, which is a no-op on
  the web and prefixes the configured origin in the native build.
- `src/utils/bleHost.ts` ŌĆö adapts the Capacitor Bluetooth LE plugin to the same
  `BluetoothHost` interface the web build uses with `navigator.bluetooth`. The
  e-scooter protocol engine and UI are shared verbatim; only the transport
  differs.
- `assets/` ŌĆö the icon and splash source images. `npx capacitor-assets generate`
  rasterises the full Android/iOS icon set from `assets/icon.png` and the
  splash set from `assets/splash.png`.
- `android/` and `ios/` ŌĆö the checked-in native projects. **Generated artifacts
  inside them (copied web assets, `Pods/`, `build/`, `local.properties`) are
  git-ignored** ŌĆö see each platform's own `.gitignore`.

## API access (why the native app used to fail)

In the browser, `/api/*` is same-origin, so a relative path is correct. In the
packaged app it is not: Capacitor registers a wildcard handler for the WebView
origin, so a relative `/api/...` request is answered from the app's own asset
bundle (a 404) and **never reaches the network** — the exact reason “the APIs
work on the website but not in the native app”.

The fix has two parts:

1. **Address the API by its real origin.** The native build inlines
   `VITE_API_BASE_URL=https://www.stakeys-cycles.co.uk` (see the
   `android:sync` / `ios:sync` scripts). `apiUrl()` then turns every `/api/*`
   call absolute. On the web the variable is unset, so requests stay relative.
2. **Enable the native HTTP bridge.** `plugins.CapacitorHttp.enabled` is `true`
   in `capacitor.config.json`. CapacitorHttp performs the request from native
   code, which bypasses the browser's CORS checks — required because the API
   sends no `Access-Control-Allow-Origin` header and answers `OPTIONS` with 405.

The WebView origin is deliberately **not** the production domain, so the API
origin always differs from the WebView origin and the native bridge is used for
it. OAuth popups and absolute links (Supabase auth, Google/Meta consent) are
unaffected: they are already absolute URLs, which `apiUrl()` passes through.

Set `VITE_API_BASE_URL` to any other deployment (staging) to point the app there.

## Icons & splash

```bash
# Regenerate every Android/iOS launcher icon + splash from assets/
npx capacitor-assets generate --android --ios \
  --iconBackgroundColor '#050505' --splashBackgroundColor '#050505'
```

`assets/icon.png` (opaque, full-bleed) and `assets/icon-foreground.png`
(transparent) are the Stakey's shield logo rendered with the real brand fonts.

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
`BLUETOOTH`/`BLUETOOTH_ADMIN`/`ACCESS_FINE_LOCATION` pair (API Ōēż 30), `CAMERA`
for QR scanning, and `POST_NOTIFICATIONS` for OneSignal push.

## Two apps: staff + customer

One native project ships **two installable apps** — the staff terminal and the
customer app — so a new build produces two APKs with no code duplication.

- `android/app/build.gradle` defines product flavors `staff` and `customer`.
  A flavor only sets the installable identity: `applicationId`
  (`uk.co.stakeyscycles.staff` / `uk.co.stakeyscycles.customer`) and the icon
  tint (`customer/res/values/colors.xml` overrides `ic_launcher_background`
  to brand green; the staff app keeps black). The app name comes from the
  flavor's `strings.xml`.
- The web surface bundled into each APK is chosen at build time via
  `VITE_SURFACE` (`staff` / `customer`), so each app carries only its own code
  path. Both point at the same API (`VITE_API_BASE_URL`).

Build both at once:

```bash
npm run apps:build             # both APKs, production API
npm run apps:build:staff       # just the staff app
npm run apps:build:customer    # just the customer app
```

The script re-syncs the web assets once per app (so the correct surface is
bundled), then assembles each flavor. Output lands in `preview/apps/`:

```
preview/apps/stakeys-staff.apk      uk.co.stakeyscycles.staff
preview/apps/stakeys-customer.apk   uk.co.stakeyscycles.customer
```

Options: `--api https://...` to point both apps at another API, `--only staff`
or `--only customer`, `--release` for release variants (needs a signing
config). The script sets `JAVA_HOME`/`ANDROID_HOME` defaults and writes
`android/local.properties`, so it works from a bare shell.

Run this after any change that should ship to both apps. Because the two APKs
are built from the same tree, keeping the branches in parity (see below) is
what keeps the two apps identical apart from their surface.


## iOS

Requirements: **macOS with Xcode and CocoaPods.** The iOS app cannot be built
on Linux or Windows ŌĆö the toolchain (`xcodebuild`, the iOS SDK) is
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
transport in order: injected host (tests) ŌåÆ `navigator.bluetooth` (web) ŌåÆ
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
`ios/App/App/public/` ŌĆö they are per-surface build output and would break
`npm run check:parity`.
