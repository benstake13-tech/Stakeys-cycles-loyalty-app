import { describe, expect, it } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { HOLIDAY_THEME_IDS } from '../../utils/holidayCalendar';
import { ThemeArtwork } from './ThemeArtwork';
import { shopPhotoFor } from './shopPhotos';
import { worldFor } from './worldCatalog';

describe('seasonal shop photographs', () => {
 it('provides a locally bundled rendered scene for every selectable theme', () => {
  for (const id of HOLIDAY_THEME_IDS) {
   const path = shopPhotoFor(id);
   expect(path.startsWith('/seasonal/')).toBe(true);
   const file = join(process.cwd(), 'public', path);
   expect(existsSync(file), `${id}: ${path}`).toBe(true);
   expect(statSync(file).size, `${id}: ${path}`).toBeGreaterThan(100_000);
  }
 });

 it('keeps the shop sign and scene framing consistent as the holiday changes', () => {
  const halloween = renderToStaticMarkup(<ThemeArtwork world={worldFor('halloween')!}/>);
  const easter = renderToStaticMarkup(<ThemeArtwork world={worldFor('easter')!}/>);
  expect(halloween).toContain('/seasonal/halloween.jpg');
  expect(easter).toContain('/seasonal/easter.jpg');
  expect(halloween).toContain('STAKEY’S CYCLES');
  expect(easter).toContain('STAKEY’S CYCLES');
  expect(halloween).toContain('viewBox="0 0 1672 941"');
  expect(easter).toContain('viewBox="0 0 1672 941"');
 });
});
