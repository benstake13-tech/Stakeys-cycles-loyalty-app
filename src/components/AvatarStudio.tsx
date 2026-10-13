import React from 'react';

/** Customer-facing 2D avatar studio. The wardrobe is bundled in Vite public assets. */
export const AvatarStudio: React.FC = () => (
  <section aria-label="Stakey's Cycles avatar and wardrobe studio" className="w-full overflow-hidden rounded-2xl border border-emerald-500/20 bg-[#07120f]">
    <iframe
      title="Stakey's Cycles Avatar and Wardrobe Studio"
      src="/avatar-wardrobe/index.html"
      className="block w-full border-0"
      style={{ height: 'min(86vh, 1000px)', minHeight: 650 }}
      loading="eager"
      allow="clipboard-write"
    />
    <p className="px-4 py-2 text-xs text-emerald-100/60">
      Avatar settings are saved locally on this device. Use Export PNG to save your character.
    </p>
  </section>
);
