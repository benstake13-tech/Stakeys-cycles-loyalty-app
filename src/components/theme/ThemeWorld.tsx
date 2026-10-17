import type { CSSProperties } from 'react';
import { ThemeArtwork } from './ThemeArtwork';
import { worldFor } from './worldCatalog';
import './themeWorld.css';

/** Static rendered shop scene shared by previews and all three app surfaces. */
export function ThemeWorld({ theme, preview = false }: { theme: string; preview?: boolean }) {
  const world = worldFor(theme);
  if (!world) return null;
  return <div className={`theme-world ${preview ? 'theme-world-preview' : 'theme-world-background'}`}
    data-theme={theme} data-renderer="artwork" data-motion="still" aria-hidden="true"
    style={{ '--world-accent': world.accent } as CSSProperties}>
    <ThemeArtwork world={world} />
  </div>;
}
