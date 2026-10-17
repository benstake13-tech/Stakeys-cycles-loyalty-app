import type { WorldSpec } from './worldCatalog';
import { shopPhotoFor } from './shopPhotos';

/** The shop and its sign share one camera across every seasonal scene. */
export function ThemeArtwork({ world }: { world: WorldSpec }) {
 return <svg className="theme-artwork" viewBox="0 0 1672 941" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  <image href={shopPhotoFor(world.id)} width="1672" height="941"/>
  <text className="theme-shop-sign" x="1092" y="133" textAnchor="middle" textLength="670" lengthAdjust="spacingAndGlyphs">STAKEY’S CYCLES</text>
 </svg>;
}
