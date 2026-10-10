import { describe, it, expect } from 'vitest';
import {
  activeHoliday,
  resolveTheme,
  upcomingHolidays,
  HOLIDAY_THEME_IDS,
  isSeasonalThemeId,
} from './src/utils/holidayCalendar';
import { sceneFor, SCENES } from './src/components/theme/scenes';
import { weatherFor } from './src/components/theme/weather';
import { v3, box, prism, merge, compose, project, CAM } from './src/components/theme/sceneKit';
import {
  blackFriday,
  cyberMonday,
  smallBusinessSaturday,
  fathersDayUk,
  springBankHolidayUk,
  summerBankHolidayUk,
} from './src/utils/lunar';

describe('seasonal theme calendar', () => {
  it('activates Halloween across its window', () => {
    expect(activeHoliday(new Date('2026-10-31T12:00:00Z'))?.theme).toBe('halloween');
    // 9-day window: 2 days before and 2 days after still count.
    expect(activeHoliday(new Date('2026-10-29T12:00:00Z'))?.theme).toBe('halloween');
    expect(activeHoliday(new Date('2026-11-01T12:00:00Z'))?.theme).toBe('halloween');
  });

  it('activates Christmas and New Year in December/January', () => {
    expect(activeHoliday(new Date('2026-12-25T12:00:00Z'))?.theme).toBe('christmas');
    expect(activeHoliday(new Date('2027-01-01T12:00:00Z'))?.theme).toBe('newyear');
  });

  it('honours a manual override over the calendar', () => {
    const summer = new Date('2026-07-15T12:00:00Z');
    expect(resolveTheme('AUTO', summer)).toBe('none');
    expect(resolveTheme('christmas', summer)).toBe('christmas');
    expect(resolveTheme(null, summer)).toBe('none');
  });

  it('lists upcoming holidays in chronological order', () => {
    const up = upcomingHolidays(new Date('2026-01-02T12:00:00Z'), 3);
    expect(up.length).toBe(3);
    for (let i = 1; i < up.length; i++) {
      expect(up[i].celebration.getTime()).toBeGreaterThanOrEqual(up[i - 1].celebration.getTime());
    }
  });

  it('validates theme ids', () => {
    expect(isSeasonalThemeId('halloween')).toBe(true);
    expect(isSeasonalThemeId('none')).toBe(true);
    expect(isSeasonalThemeId('nonsense')).toBe(false);
  });

  it('activates the new-season and UK-calendar themes on their dates', () => {
    expect(activeHoliday(new Date('2025-11-05T12:00:00Z'))?.theme).toBe('bonfirenight');
    expect(activeHoliday(new Date('2026-04-23T12:00:00Z'))?.theme).toBe('stgeorge');
    expect(activeHoliday(new Date('2026-01-04T12:00:00Z'))?.theme).toBe('januarysales');
    expect(activeHoliday(new Date('2026-04-15T12:00:00Z'))?.theme).toBe('earthday');
    expect(activeHoliday(new Date('2026-12-15T12:00:00Z'))?.theme).toBe('winter');
    expect(activeHoliday(new Date('2025-03-04T12:00:00Z'))?.theme).toBe('pancakes');
  });

  it('computes the Thanksgiving-offset shopping holidays', () => {
    // Thanksgiving 2026 = 26 Nov → Black Friday 27, Small Business Sat 28, Cyber Mon 30.
    expect(blackFriday(2026)).toEqual({ year: 2026, month: 11, day: 27 });
    expect(smallBusinessSaturday(2026)).toEqual({ year: 2026, month: 11, day: 28 });
    expect(cyberMonday(2026)).toEqual({ year: 2026, month: 11, day: 30 });
  });

  it('computes UK bank holidays and Father’s Day', () => {
    expect(fathersDayUk(2026)).toEqual({ year: 2026, month: 6, day: 21 });
    expect(springBankHolidayUk(2026)).toEqual({ year: 2026, month: 5, day: 25 });
    expect(summerBankHolidayUk(2026)).toEqual({ year: 2026, month: 8, day: 31 });
  });
});

describe('theme engine registry completeness', () => {
  it('has a scene and weather spec for every concrete theme', () => {
    for (const id of HOLIDAY_THEME_IDS) {
      expect(sceneFor(id), `scene for ${id}`).toBeTruthy();
      expect(weatherFor(id), `weather for ${id}`).toBeTruthy();
      expect(SCENES[id as keyof typeof SCENES].label.length).toBeGreaterThan(0);
    }
    expect(sceneFor('none')).toBeUndefined();
    expect(weatherFor('none')).toBeNull();
  });

  it('every scene builds a non-empty, in-range geometry', () => {
    for (const id of HOLIDAY_THEME_IDS) {
      const scene = sceneFor(id)!;
      const geos = scene.build(1280);
      expect(geos.length, `${id} produces props`).toBeGreaterThan(0);
      const verts = geos.reduce((n, g) => n + g.verts.length, 0);
      expect(verts, `${id} has vertices`).toBeGreaterThan(50);
    }
  });
});

describe('scene kit geometry + projection', () => {
  it('merges and composes transforms without losing faces', () => {
    const g = compose([
      { geo: box(2, 2, 2, '#ffffff'), t: { pos: v3(0, 0, 0) } },
      { geo: box(2, 2, 2, '#000000'), t: { pos: v3(5, 0, 0), scale: 2, rotY: 0.5 } },
    ]);
    expect(g.verts.length).toBe(48); // two boxes × 24 verts (prism keeps its own corners)
    expect(g.faces.length).toBe(12);
  });

  it('prism caps top and bottom', () => {
    const p = prism(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      3,
      '#123456'
    );
    // 4 sides + bottom + top
    expect(p.faces.length).toBe(6);
  });

  it('projects points in front of the camera and rejects points behind it', () => {
    const ahead = project(v3(CAM.pos.x, CAM.pos.y, CAM.pos.z + 200), 1000, 800);
    expect(ahead).not.toBeNull();
    const behind = project(v3(CAM.pos.x, CAM.pos.y, CAM.pos.z - 200), 1000, 800);
    expect(behind).toBeNull();
  });
});
