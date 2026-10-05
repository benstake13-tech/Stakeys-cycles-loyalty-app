-- AI likeness portrait for the customer avatar.
-- Stores an AvatarImage record: { dataUrl (base64 png), prompt, model, createdAt }.
-- Nullable; the vector avatar_config remains the fallback when no portrait exists.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_image JSONB;
