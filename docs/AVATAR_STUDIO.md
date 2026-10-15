# Stakey's Avatar Studio — character asset integration

The customer portal now has a mobile-oriented 3D character studio. It uses the locally bundled `@google/model-viewer` runtime and supports imported glTF 2.0 binary (`.glb`) files up to 40 MB.

## Supply the character

Add a **licensed** mobile-optimised human GLB to `public/models/stakeys-avatar.glb` to enable the default preview, or use **Import 3D avatar (.glb)** in the studio for a temporary local preview. Imported files are not uploaded or retained between app sessions. Avatar **settings** are stored in localStorage on that device only; they are not synced to Supabase.

For Android performance, target one rigged character, a restrained texture budget (ideally 1–2K compressed maps), minimal draw calls, and reduced polygon count. Profile and test on a real midrange phone. Photorealistic appearance depends on the actual character, textures, hair and lighting assets.

## Material binding convention

The editor searches case-insensitively for the following strings in glTF material names:

| Control | Material name contains |
| --- | --- |
| Skin tone / skin roughness | Skin, Face, BodyMat, Flesh |
| Hair colour | Hair, Beard, Brow |
| Emerald brand accent | Accent, Trim, Brand |

Names should be unambiguous. Skin/hair swatches recolour compatible materials via the model-viewer scene-graph API. This is tinting, not automatic creation of skin or hair geometry.

## Animation binding convention

Include clips named `Idle`, `Smile`, `Serious`, `Focused`, `Stand`, `Casual`, `Workshop`, `Jersey`, `Winter`, etc. The studio selects a matching clip when the user changes expression or pose. Clips that are not present are skipped gracefully.

## Not yet supported

The sliders for face shape, eye size, nose, jaw, body proportions, hairstyle geometry, garments, and helmets are **not** connected to morph targets or interchangeable meshes. Model-viewer does not offer a general character-rig morph authoring workflow. Those features need a compatible rig, dedicated WebGL character engine, or Unreal-hosted avatar pipeline. Do not advertise them as working on the live 3D character.

## Release checklist

1. Supply the licensed rigged character GLB and any required model rights.
2. Validate the GLB on Android, including material names and animations.
3. Run `npm install`, `npm run lint`, and `npm run build`.
4. Build and test the customer APK, including offline launch and storage persistence.
5. Check privacy/security before implementing customer account cloud syncing.
