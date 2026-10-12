# Stakey's Cycles Android Installers

Two separate Android APKs are built from the same source code, with different branded entrypoints.

| Edition | Android application ID | Sign-in | Main screen |
| --- | --- | --- | --- |
| Customer | `uk.co.stakeyscycles.customer` | Customer email/password, registration | Membership, garage, repairs, rewards |
| Staff | `uk.co.stakeyscycles.staff` | Authorized staff email/password | Workshop terminal and staff tools |

## Download the latest builds

Check [Android APK releases](https://github.com/benstake13-tech/Stakeys-cycles-loyalty-app/releases) or [the Android workflow](https://github.com/benstake13-tech/Stakeys-cycles-loyalty-app/actions/workflows/android-apks.yml). The workflow builds, checksums and publishes both APKs for each relevant source change.

These are **debug-signed test installers**, not Google Play production builds. They are suitable for direct installation on test Android phones. A stable production release requires a private, backed-up Android release signing key and a tested release build. A new debug build can use a different signature from a previous run; Android may require uninstalling the old test APK first (this clears local device storage, though cloud-held records remain). Do not uninstall a device copy containing important unsynced local data without exporting it.

## Install

1. Download the **Customer** or **Staff** APK from the latest Android release.
2. Open the APK on your Android device. If asked, grant permission to install from that download source.
3. The apps can coexist because their Android package IDs differ.
4. Use your existing Supabase account to sign in. Staff accounts must already be authorized in Supabase.

## Configure the Gemini bike identification feature

Packaged Android assets are local, so `fetch('/api/gemini/scan-bike')` does **not** connect to your online backend automatically.

- Deploy the server endpoint `POST /api/gemini/scan-bike` under an HTTPS domain (for example using Vercel's `api/gemini/scan-bike.ts` route or the Express server).
- Configure **`GEMINI_API_KEY` only on that server**, not in the Android build and not in any `VITE_` variable.
- In GitHub repository **Settings → Secrets and variables → Actions → Variables**, create `APP_API_ORIGIN` containing the public HTTPS backend origin, without `/api` (such as `https://your-backend.example`).
- Re-run the Android APK workflow and download the new installers. Both editions will build with the API origin.
- The backend has limited CORS handling for the Capacitor WebView origin. Before public launch, restrict abusive requests and verify Supabase authorization and usage limits.

If `APP_API_ORIGIN` has not been configured, regular loyalty and workshop features may connect to Supabase, but the photo AI scanner clearly reports that the shop AI server still needs configuration. The Gemini API key is never embedded in the APK.

## Build notes

- Capacitor 8 + Java 21 + Android SDK API 36.
- `capacitor.config.ts` sets edition-specific app IDs and titles.
- `VITE_APP_EDITION=customer|staff` selects dedicated sign-in and shell screens at build time.
- `.github/workflows/android-apks.yml` performs the builds, uploads the APKs and publishes test releases.
- No database schema or customer data is modified by an APK build.

A successful build verifies compilation and archive generation, not real-phone login, camera, notification, AI, or booking functionality. These need device and backend tests before customer distribution.
