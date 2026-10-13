# Push and seasonal theme rebuild — 13 October 2026

## Implemented
- Platform-aware OneSignal bootstrap: Android uses the native plugin and its own public App ID; the Web SDK loads only for browser clients.
- Web SDK calls, runtime configuration and native bridge operations have bounded waits. Expired queued requests cannot later open a permission prompt.
- Android permission bridge handles both immediate Kotlin results and suspended continuations, with a single guarded completion and a 30-second timeout.
- Permission, subscription registration and delivery are separate states. Enable-device no longer runs the test-send repair pipeline.
- Shared staff/customer theme renderer: shaded SVG dioramas, seasonal props, snow, petals, leaves, lanterns and celebration effects. These are 3D-style vector scenes, not WebGL models or photographic renders.
- Theme studio supports searchable collections, previews, explicit save, error handling and Supabase-backed shared theme selection. Device-only motion preference uses local storage; shared themes continue to use Supabase.
- Reduced motion overrides animations; effects pause when the page is hidden. Particle count is capped at 16 (gentle) or 32 (full).

## Validation
- TypeScript check passed.
- Staff and customer production Vite builds passed, with the existing large-chunk warning.
- Focused push, theme and header suite: 58 tests passed.
- Final full suite: 164 files, 1397 tests passed.
- Customer fix branch independently passed TypeScript, production build and 43 focused push/theme tests. Shared push/theme implementation files are identical across the two fix branches.
- Christmas and Halloween SVG artwork rendered and visually inspected.

## Remaining verification / environment limits
- No updated APK has been produced. This environment has Java 17, no configured Android SDK, and lacks the Java 21 Android build toolchain.
- No real Android permission dialog, FCM registration or background notification delivery has been tested. Public Android App ID must match the OneSignal app configured with FCM; sending backend credentials must address the same app. Separate Web/Android OneSignal apps still need matching server-side routing configuration.
- Mobile CSS is implemented but browser/device layout and animation QA is not complete: no installed Playwright browser, and local listening sockets are blocked.
- Existing Supabase theme policies were reused; live save/realtime synchronization was not tested against production.
- Work is based on the available local staff-terminal checkout (b1b935f), not a newly fetched remote head. Review/rebase these fixes against current remote work before integration.
- No push, production deploy or CI deployment trigger was performed.
