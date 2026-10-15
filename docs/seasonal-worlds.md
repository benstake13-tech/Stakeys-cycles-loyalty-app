# Stakeys seasonal woodland replacement

## Implementation and current scope

The production Theme3DCanvas now loads the Three.js woodland engine from
`tools/seasonal/scene.js`. The old sphere/cone characters and display platforms
are no longer selected by the production component. The old geometry module
remains for compatibility with its existing tests and exported type/catalogue
helpers; it is not the active renderer.

Halloween uses a textured goblin with the original 156-joint face/body rig and
IdleAnimation, additive eyelid/gaze/ear/jaw/arm/cape reactions, and an authored
four-bone cloth ghost. The scene includes a winding cobbled lane, textured
workshop, textured ground/bark, layered woodland and vegetation, lanterns,
pumpkins, mist, falling leaves and flapping bats. All resources are packaged.

Christmas/Boxing Day use a rigged Santa. St Patrick's uses a rigged leprechaun
and fox. Easter uses two rigged rabbits. Other seasonal settings use the
textured fox/rabbit cast with seasonal lighting, snow, foliage, heart props
or workshop lights. Remembrance has still poppies and no comical character;
Ramadan, Eid and Hanukkah use quiet, character-free woodland.

**The entire requested holiday cast is not finished.** There is no dedicated
Christmas elf or winged Cupid yet; several holidays share the wildlife cast
rather than having individually authored beings/environments. This is a
substantial environment and Halloween replacement, not a claim that every
holiday now meets the full bespoke character brief. Candidate assets with
non-commercial licences or malformed rigs were excluded.

Existing calendar scheduling, staff overrides and device motion preferences
are retained. Full/gentle/still modes, reduced motion, passive pointer input,
scroll cancellation, accessible reaction buttons, context restoration,
offscreen/hidden pauses and asynchronous unmount cleanup are handled by the
React canvas wrapper. Opening the scene modal removes the covered background
canvas so two full scenes do not compete for GPU memory.

## Assets and reproducibility

`public/theme-assets/ASSET-NOTICES.txt` contains attribution and licence links.
`tools/seasonal/asset-sources.json` records sources and redistribution terms.
`public/theme-assets/asset-manifest.json` records byte sizes, SHA-256 digests
and the renderer-source digest. GLBs embed their textures/buffers; there are
no third-party model URLs at runtime. The cloth ghost, bats and environment
composition are authored in the renderer source.

`npm run themes:bundle` regenerates the standalone renderer and manifest.
`npm run build` runs this before Vite. The app uses a normal Vite lazy import
of the same source, so it also works in Vite development without importing
JavaScript from the public directory. The standalone bundle supports offline
previews and is packaged alongside the assets.

Asset processing used glTF Transform 4.3.0 with no geometry decoder dependency.
Texture sizes are capped at 1024px for the characters. The leprechaun was
simplified from about 724k triangles to about 58k. Character skeletons and
animation clips are retained. The ghost uses weighted cloth vertices. Static
architecture/tree meshes are batched by material and vegetation is instanced.

## Verification and limits

- Full local test suite: 199 files / 1,564 tests passed.
- TypeScript passed. Relevant tests were rerun after integration changes.
- Desktop and portrait Chromium WebGL views and character selection, reaction
  and recovery were exercised. A React StrictMode integration harness verified
  editable form input, the accessible reaction control, motion mode switching,
  theme switching and stable reduced-motion rendering.
- Performance sample: portrait 390×844, DPR 1, SwiftShader software rendering:
  42 draw calls, about 256k triangles; median full-frame draw about 11ms,
  slowest/p95 sample about 181ms across 12 samples. This small software sample
  is not an Android hardware benchmark or a frame-rate guarantee.
- No physical Android device was available. Device thermal behaviour, touch
  comfort, GPU memory pressure and real-world FPS still need hardware testing.
- The APK builder records `theme-build.json` with the exact source commit and
  surface. `scripts/verify-theme-apk.py` verifies every packaged seasonal file,
  the actual app renderer chunk, and the commit/surface metadata after Gradle.

## Delivery source and release gate

Customer APK workflow targets `customer-app` (not the older `main`). Staff
uses `staff-terminal`. The working website source is `main-website` in
`benstake13-tech/Stakeys-cycles-loyalty-app`. The live stakeys.co.uk HTML/JS
belongs to that application family; the separate `Stakeys-cycles` repository
is a different marketing application and was not modified.

The upstream branches already differ outside surface.ts in marketplace,
membership and notification/website changes. Their history also diverges.
The required sync gate fails before this work; those unrelated features have
not been overwritten to manufacture parity. Theme changes are therefore
prepared on separate review/build branches based on each surface's own head.
Do not describe them as a live release until the gate and Vercel deployment
have actually succeeded. The inspected Vercel statuses report build-rate-limit
failures. Deleting projects has not been performed or authorised by this work.
