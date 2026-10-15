# Stakey's Cycles image storage

Run `supabase/migrations/20261013_image_storage.sql` in the project's Supabase SQL editor.
This repository already uses `@supabase/supabase-js`. Import helpers from `src/lib/imageStorage.ts`.

Public images: `stakeys-images` with categories `branding/`, `products/`, `services/`, `website/`, `staff/`.
Upload the genuine approved logo to `branding/official-logo.png`; the repository's existing SVG must not be treated as proof that this is the official supplied artwork.
Private customer bike images: `stakeys-private`, paths `<user-uuid>/bikes/<random-uuid>.<ext>`.
Metadata lives in `public.app_images`; never store image binary/base64 in database rows.
Public image upload requires Supabase Auth JWT `app_metadata.role` = `staff` or `admin`; client-side staff PIN alone does not grant this role.
Private images require authenticated ownership; use short-lived signed URLs, not public URLs.
All three apps must point at the same Supabase project and import equivalent helpers.
Do not remove legacy assets until references are migrated and validated.
Run build, lint and authenticated upload/read tests after migration. No migration or deployment is performed by this Git commit.
