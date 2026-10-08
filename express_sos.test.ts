import { describe, it, expect } from 'vitest';
import {
  EXPRESS_SOS_TILES,
  EXPRESS_SOS_SURCHARGE,
  SOS_RIDER_LANGUAGES,
  SOS_TILE_TOOLTIPS,
  SOS_VOICE_MAX_SECONDS,
  buildExpressSosNote,
  expressSosCtaLabel,
  expressSosIssueIds,
  expressSosStepsComplete,
  expressSosTileFor,
  formatGpsLocation,
  sosTileHint,
} from './src/utils/expressSos';
import { ALL_BIKE_ISSUES_MAP } from './src/data/bikeIssuesCatalog';
import { isSosBooking } from './src/utils/sosRepair';

describe('Express SOS — visual category grid', () => {
  it('offers exactly the six icon tiles from the spec', () => {
    expect(EXPRESS_SOS_TILES).toHaveLength(6);
    expect(EXPRESS_SOS_TILES.map((t) => t.id)).toEqual([
      'brakes',
      'gears',
      'wheels',
      'ebike',
      'snapped',
      'other',
    ]);
    expect(EXPRESS_SOS_TILES.map((t) => t.emoji)).toEqual(['🛑', '⚙️', '🚲', '⚡', '💥', '❓']);
  });

  it('maps each tile to real symptom ids the mechanic already knows', () => {
    for (const tile of EXPRESS_SOS_TILES) {
      for (const id of tile.issueIds) {
        expect(ALL_BIKE_ISSUES_MAP.has(id), `${tile.id} -> ${id}`).toBe(true);
      }
    }
    // "Other / Total Breakdown" carries the rider's own words instead.
    expect(expressSosIssueIds('other')).toEqual([]);
  });

  it('resolves a tile by id and returns nothing for an unknown id', () => {
    expect(expressSosTileFor('wheels')?.tag).toBe('Tires & Wheels');
    expect(expressSosTileFor('')).toBeUndefined();
    expect(expressSosTileFor(null)).toBeUndefined();
  });
});

describe('Express SOS — rider-language tooltips', () => {
  it('covers the five translated languages plus English', () => {
    expect(SOS_RIDER_LANGUAGES.map((l) => l.code)).toEqual(['en', 'es', 'pt', 'ro', 'ur', 'ar']);
    for (const lang of ['es', 'pt', 'ro', 'ur', 'ar']) {
      for (const tile of EXPRESS_SOS_TILES) {
        expect(SOS_TILE_TOOLTIPS[lang][tile.id], `${lang}/${tile.id}`).toBeTruthy();
      }
    }
  });

  it('returns English for en and falls back to English for unknown languages', () => {
    const brakes = expressSosTileFor('brakes')!;
    expect(sosTileHint(brakes, 'en')).toBe(brakes.hint);
    expect(sosTileHint(brakes, 'zz')).toBe(brakes.hint);
    expect(sosTileHint(brakes, 'es')).toMatch(/frena/i);
  });
});

describe('Express SOS — note building & diagnostics', () => {
  it('writes a marker, category, fault, location, surcharge and media lines', () => {
    const note = buildExpressSosNote({
      tileId: 'gears',
      faultText: 'Chain snapped outside the Co-op',
      location: 'Mill Street, Salford',
      vehicleLabel: 'Carrera Vengeance',
      photoAttached: true,
      voiceAttached: true,
    });

    expect(note).toContain('EXPRESS SOS CALL-OUT');
    expect(note).toContain('Issue category: ⚙️ Gears & Chain');
    expect(note).toContain('Vehicle: Carrera Vengeance');
    expect(note).toContain('Fault: Chain snapped outside the Co-op');
    expect(note).toContain('Rider location: Mill Street, Salford');
    expect(note).toContain('Express surcharge: £15.00');
    expect(note).toContain('Photo: captured in the app');
    expect(note).toContain('Voice note: recorded in the app');
    // The marker makes the job recognisable to the existing SOS logic.
    expect(isSosBooking({ isSos: false, notes: note })).toBe(true);
  });

  it('falls back to the tile hint when the rider gives no words, and to "Other" for the unknown tile', () => {
    const note = buildExpressSosNote({ tileId: 'other', location: 'A6 layby' });
    expect(note).toContain('Fault: Not sure · everything stopped');
    expect(note).toContain('Issue category: ❓ Other / Breakdown');
  });

  it('stores uploaded media URLs when present', () => {
    const note = buildExpressSosNote({
      tileId: 'wheels',
      location: 'Here',
      photoUrl: 'data:image/jpeg;base64,AAAA',
      voiceUrl: 'data:audio/webm;base64,BBBB',
    });
    expect(note).toContain('Photo: data:image/jpeg;base64,AAAA');
    expect(note).toContain('Voice note: data:audio/webm;base64,BBBB');
  });
});

describe('Express SOS — location, CTA and 3-tap progress', () => {
  it('formats a GPS fix with and without a resolved place', () => {
    const coords = { latitude: 53.48312, longitude: -2.29311 };
    expect(formatGpsLocation(coords)).toBe('53.48312, -2.29311');
    expect(formatGpsLocation(coords, 'Salford')).toBe('Salford (53.48312, -2.29311)');
  });

  it('labels the primary CTA with the express surcharge', () => {
    expect(expressSosCtaLabel()).toBe('Request Immediate SOS Call-Out — £15 Express');
    expect(EXPRESS_SOS_SURCHARGE).toBe(15);
    expect(SOS_VOICE_MAX_SECONDS).toBe(15);
  });

  it('counts the three taps', () => {
    expect(expressSosStepsComplete({ tileSelected: false, locationSet: false, contactSet: false })).toEqual({ done: 0, total: 3 });
    expect(expressSosStepsComplete({ tileSelected: true, locationSet: true, contactSet: true })).toEqual({ done: 3, total: 3 });
    expect(expressSosStepsComplete({ tileSelected: true, locationSet: false, contactSet: true }).done).toBe(2);
  });
});
