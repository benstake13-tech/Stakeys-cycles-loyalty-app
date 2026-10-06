/**
 * Every supported holiday as a declarative scene: palette + prop scatter +
 * horizon ridges + the ambient motion the canvas should layer on top.
 *
 * Scenes are pure data (builders are lazy closures) so the whole registry stays
 * small and can be split from the renderer.
 */
import {
  SeasonScene,
  V3,
  building,
  bareTree,
  blossomTree,
  scatter,
  gazebo,
  gravestone,
  lantern,
  menorah,
  pagoda,
  pine,
  pumpkin,
  fiestaPole,
  tent,
  topiaryHeart,
  v3,
  pick,
} from './sceneKit';
import type { SeasonalThemeId } from '../../utils/holidayCalendar';

type SceneKey = Exclude<SeasonalThemeId, 'none'>;

// ---------------------------------------------------------------------------
// Halloween — cinematic gothic street, not cartoonish splatter
// ---------------------------------------------------------------------------
const HALLOWEEN: SeasonScene = {
  label: 'Halloween',
  ambient: 'bats',
  palette: {
    skyTop: '#0a0716',
    skyHorizon: '#2c2352',
    fog: '#241d3f',
    ground: '#1a1430',
    groundAlt: '#241c3d',
    sun: '#e8ddc0',
    sunPos: v3(-150, 250, 420),
    ambient: 0.42,
    night: true,
    road: '#120d24',
  },
  ridges: [
    { color: '#120c22', z: 980, radius: 260, height: 190, count: 6 },
    { color: '#1c1433', z: 600, radius: 190, height: 130, count: 7 },
  ],
  build: () =>
    scatter([
      // Close, crooked gothic houses packed tightly into the middle-foreground.
      { count: 6, zRange: [150, 430], make: () => building({ w: 22, h: 34, d: 18, wall: '#2a2340', roof: '#161028', window: '#ffb347', windowGlow: 0.6, stories: 3, cols: 2 }), scale: [1.1, 1.7] },
      { count: 5, zRange: [300, 640], make: () => building({ w: 26, h: 40, d: 20, wall: '#241d38', roof: '#120c22', window: '#f59e0b', windowGlow: 0.5, stories: 4, cols: 3 }), scale: [1.2, 1.8] },
      { count: 10, zRange: [80, 620], make: () => bareTree(1, '#241d33'), scale: [1.1, 2.1] },
      { count: 7, zRange: [120, 520], make: () => gravestone(1), scale: [0.9, 1.5] },
      { count: 6, zRange: [90, 380], make: () => pumpkin(1, pick(['#c2410c', '#ea580c', '#7c2d12'])), scale: [1, 1.6] },
    ]),
};

// ---------------------------------------------------------------------------
// Christmas — snowy Victorian high street, warm windows, huge moon
// ---------------------------------------------------------------------------
const CHRISTMAS: SeasonScene = {
  label: 'Christmas',
  ambient: 'santa',
  palette: {
    skyTop: '#050d22',
    skyHorizon: '#2b4a72',
    fog: '#2c4562',
    ground: '#e8f0ff',
    groundAlt: '#c9dcf6',
    sun: '#f4f8ff',
    sunPos: v3(190, 250, 380),
    ambient: 0.58,
    night: true,
    road: '#aebfd8',
  },
  ridges: [
          { color: '#1c3050', z: 980, radius: 250, height: 170, count: 6 },
    { color: '#26405c', z: 600, radius: 190, height: 120, count: 7 },
  ],
  build: () =>
    scatter([
      { count: 6, zRange: [150, 430], make: () => building({ w: 22, h: 32, d: 18, wall: '#5b3a24', roof: '#7f1d1d', window: '#fbbf24', windowGlow: 0.9, stories: 3, cols: 2, snow: '#f4f8ff' }), scale: [1.1, 1.7] },
      { count: 5, zRange: [320, 660], make: () => building({ w: 26, h: 38, d: 20, wall: '#3f2a1c', roof: '#0e7490', window: '#fde68a', windowGlow: 0.85, stories: 4, cols: 3, snow: '#f4f8ff' }), scale: [1.2, 1.8] },
      { count: 14, zRange: [70, 720], make: () => pine(1, true), scale: [1, 2] },
      { count: 6, zRange: [120, 400], make: () => pine(1, true), scale: [0.6, 1.1] },
    ]),
};

// ---------------------------------------------------------------------------
// St. Patrick's Day — rolling emerald hills, gold at the horizon
// ---------------------------------------------------------------------------
const STPATRICKS: SeasonScene = {
  label: "St. Patrick's Day",
  palette: {
    skyTop: '#0c3b2a',
    skyHorizon: '#8fd6a4',
    fog: '#4f9d6a',
    ground: '#2f8f4e',
    groundAlt: '#3fa45c',
    sun: '#ffe9a8',
    sunPos: v3(-170, 270, 420),
    ambient: 0.7,
    road: '#6b4a2b',
  },
  ridges: [
    { color: '#1f6b3c', z: 1000, radius: 320, height: 130, count: 6 },
    { color: '#2b8049', z: 620, radius: 220, height: 90, count: 7 },
  ],
  build: () =>
    scatter([
      { count: 10, zRange: [80, 640], make: () => pine(1, false), scale: [0.9, 1.7] },
      { count: 6, zRange: [160, 520], make: () => blossomTree(1, '#fde68a'), scale: [1, 1.5] },
      { count: 5, zRange: [200, 560], make: () => building({ w: 16, h: 14, d: 14, wall: '#e7d8b0', roof: '#2f8f4e', window: '#fde68a', windowGlow: 0.5, stories: 1, cols: 2 }), scale: [1, 1.4] },
    ]),
};

// ---------------------------------------------------------------------------
// New Year's Eve — midnight city, fireworks
// ---------------------------------------------------------------------------
const NEWYEAR: SeasonScene = {
  label: "New Year's Eve",
  ambient: 'fireworks',
  palette: {
    skyTop: '#050818',
    skyHorizon: '#1b2450',
    fog: '#141a38',
    ground: '#0d1230',
    groundAlt: '#141a3d',
    sun: '#fff4cf',
    sunPos: v3(150, 260, 400),
    ambient: 0.44,
    night: true,
    road: '#0a0e26',
  },
  ridges: [
    { color: '#0a0e26', z: 980, radius: 250, height: 200, count: 6 },
    { color: '#121838', z: 600, radius: 190, height: 150, count: 7 },
  ],
  build: () =>
    scatter([
      { count: 7, zRange: [150, 460], make: () => building({ w: 20, h: 46, d: 18, wall: '#1b2148', roof: '#0a0e26', window: '#ffd166', windowGlow: 0.7, stories: 6, cols: 2 }), scale: [1.1, 1.7] },
      { count: 5, zRange: [330, 680], make: () => building({ w: 24, h: 54, d: 20, wall: '#161b3d', roof: '#0a0e26', window: '#ffb703', windowGlow: 0.6, stories: 7, cols: 3 }), scale: [1.2, 1.8] },
    ]),
};

// ---------------------------------------------------------------------------
// Valentine's Day — rose-lit plaza
// ---------------------------------------------------------------------------
const VALENTINES: SeasonScene = {
  label: "Valentine's Day",
  palette: {
    skyTop: '#3a0d2a',
    skyHorizon: '#cf5580',
    fog: '#8f3560',
    ground: '#662047',
    groundAlt: '#7a2754',
    sun: '#fecdd3',
    sunPos: v3(-130, 250, 410),
    ambient: 0.56,
    night: true,
    road: '#4a1730',
  },
  ridges: [
    { color: '#3f1229', z: 900, radius: 240, height: 140, count: 5 },
    { color: '#571a3a', z: 560, radius: 180, height: 100, count: 6 },
  ],
  build: () =>
    scatter([
      { count: 4, zRange: [240, 640], make: () => gazebo(1), scale: [1.1, 1.7] },
      { count: 12, zRange: [90, 620], make: () => topiaryHeart(1), scale: [0.95, 1.6] },
      { count: 6, zRange: [120, 460], make: () => blossomTree(1, '#f9a8d4'), scale: [0.9, 1.4] },
    ]),
};

// ---------------------------------------------------------------------------
// Easter — sunny meadow
// ---------------------------------------------------------------------------
const EASTER: SeasonScene = {
  label: 'Easter',
  palette: {
    skyTop: '#3f9fdc',
    skyHorizon: '#eaf6fd',
    fog: '#cfe8f5',
    ground: '#63b054',
    groundAlt: '#7cc96a',
    sun: '#fff6cf',
    sunPos: v3(-190, 300, 430),
    ambient: 0.78,
    road: '#c9a06a',
  },
  ridges: [
    { color: '#7dbd78', z: 1000, radius: 300, height: 120, count: 5 },
    { color: '#66ac61', z: 620, radius: 210, height: 80, count: 6 },
  ],
  build: () =>
    scatter([
      { count: 9, zRange: [90, 680], make: () => blossomTree(1, pick(['#f9a8d4', '#fbcfe8', '#fda4af'])), scale: [1, 1.6] },
      { count: 6, zRange: [200, 560], make: () => building({ w: 14, h: 12, d: 12, wall: '#fff7ed', roof: '#f472b6', window: '#fde68a', windowGlow: 0.5, stories: 1, cols: 2 }), scale: [1, 1.3] },
    ]),
};

// ---------------------------------------------------------------------------
// Thanksgiving — amber autumn fields, harvest barn
// ---------------------------------------------------------------------------
const THANKSGIVING: SeasonScene = {
  label: 'Thanksgiving',
  palette: {
    skyTop: '#7a3f12',
    skyHorizon: '#f2b46b',
    fog: '#c98a4a',
    ground: '#b06a2c',
    groundAlt: '#c47b38',
    sun: '#ffe1a3',
    sunPos: v3(160, 260, 420),
    ambient: 0.66,
    road: '#7a4a22',
  },
  ridges: [
    { color: '#8a4f22', z: 1000, radius: 300, height: 120, count: 5 },
    { color: '#9c5a28', z: 620, radius: 210, height: 85, count: 6 },
  ],
  build: () =>
    scatter([
      { count: 5, zRange: [200, 560], make: () => building({ w: 20, h: 16, d: 16, wall: '#8a4a24', roof: '#5b2e12', window: '#ffca7a', windowGlow: 0.7, stories: 1, cols: 3 }), scale: [1.1, 1.6] },
      { count: 12, zRange: [90, 640], make: () => bareTree(1, '#6b3a1a'), scale: [1, 1.8] },
      { count: 8, zRange: [80, 420], make: () => pumpkin(1, '#c2410c'), scale: [1, 1.6] },
    ]),
};

// ---------------------------------------------------------------------------
// Chinese New Year — red lantern street with pagodas
// ---------------------------------------------------------------------------
const CNY: SeasonScene = {
  label: 'Chinese New Year',
  ambient: 'fireworks',
  palette: {
    skyTop: '#3a0c0c',
    skyHorizon: '#c23232',
    fog: '#7d1f1f',
    ground: '#5c1a16',
    groundAlt: '#6d211c',
    sun: '#fbbf24',
    sunPos: v3(130, 250, 400),
    ambient: 0.5,
    night: true,
    road: '#3f1512',
  },
  ridges: [
    { color: '#3d1110', z: 900, radius: 240, height: 140, count: 5 },
    { color: '#541715', z: 560, radius: 180, height: 100, count: 6 },
  ],
  build: () =>
    scatter([
      { count: 5, zRange: [220, 660], make: () => pagoda(1), scale: [1.1, 1.9] },
      { count: 16, zRange: [80, 600], make: () => lantern(1, pick(['#ef4444', '#f59e0b', '#dc2626'])), scale: [0.9, 1.6] },
    ]),
};

// ---------------------------------------------------------------------------
// Mid-Autumn — lantern-lit night, harvest moon
// ---------------------------------------------------------------------------
const MIDAUTUMN: SeasonScene = {
  label: 'Mid-Autumn Festival',
  palette: {
    skyTop: '#100a2e',
    skyHorizon: '#6d3a86',
    fog: '#3d2c5e',
    ground: '#2c2148',
    groundAlt: '#3a2c5c',
    sun: '#ffe9b0',
    sunPos: v3(-140, 270, 400),
    ambient: 0.5,
    night: true,
    road: '#1d1636',
  },
  ridges: [
    { color: '#241a44', z: 900, radius: 240, height: 150, count: 5 },
    { color: '#33255a', z: 560, radius: 180, height: 110, count: 6 },
  ],
  build: () =>
    scatter([
      { count: 6, zRange: [200, 620], make: () => pagoda(1), scale: [1, 1.7] },
      { count: 14, zRange: [80, 600], make: () => lantern(1, pick(['#fbbf24', '#f59e0b', '#fde68a'])), scale: [0.9, 1.5] },
      { count: 8, zRange: [120, 520], make: () => blossomTree(1, '#fcd34d'), scale: [0.9, 1.4] },
    ]),
};

// ---------------------------------------------------------------------------
// Diwali — festival of lights, rows of diyas
// ---------------------------------------------------------------------------
const DIWALI: SeasonScene = {
  label: 'Diwali',
  ambient: 'fireworks',
  palette: {
    skyTop: '#1a0722',
    skyHorizon: '#7a2f5e',
    fog: '#4a1d46',
    ground: '#3a1430',
    groundAlt: '#4a1a3d',
    sun: '#ffd27a',
    sunPos: v3(140, 250, 400),
    ambient: 0.5,
    night: true,
    road: '#2a0f26',
  },
  ridges: [
    { color: '#2a0f26', z: 900, radius: 240, height: 150, count: 5 },
    { color: '#3a1432', z: 560, radius: 180, height: 110, count: 6 },
  ],
  build: () =>
    scatter([
      { count: 5, zRange: [220, 620], make: () => pagoda(1), scale: [1, 1.8] },
      { count: 20, zRange: [70, 560], make: () => lantern(1, pick(['#fbbf24', '#f97316', '#fca5a5'])), scale: [0.8, 1.4] },
      { count: 6, zRange: [140, 500], make: () => menorah(1), scale: [0.9, 1.4] },
    ]),
};

// ---------------------------------------------------------------------------
// Holi — festival of colours
// ---------------------------------------------------------------------------
const HOLI: SeasonScene = {
  label: 'Holi',
  palette: {
    skyTop: '#5b1a7a',
    skyHorizon: '#ff9ad5',
    fog: '#c46bb0',
    ground: '#6a2f8a',
    groundAlt: '#7d3a9c',
    sun: '#fff2a8',
    sunPos: v3(-150, 260, 420),
    ambient: 0.72,
    road: '#8a4a9c',
  },
  ridges: [
    { color: '#5b2a7a', z: 1000, radius: 300, height: 130, count: 5 },
    { color: '#6d368c', z: 620, radius: 210, height: 90, count: 6 },
  ],
  build: () =>
    scatter([
      { count: 8, zRange: [90, 640], make: () => blossomTree(1, pick(['#f472b6', '#a3e635', '#fbbf24', '#38bdf8'])), scale: [1, 1.6] },
      { count: 6, zRange: [180, 560], make: () => fiestaPole(1), scale: [1, 1.5] },
    ]),
};

// ---------------------------------------------------------------------------
// Eid al-Fitr / al-Adha — crescent moon, lanterns, tents
// ---------------------------------------------------------------------------
const EID: SeasonScene = {
  label: 'Eid',
  palette: {
    skyTop: '#04201c',
    skyHorizon: '#2f8f7a',
    fog: '#1c5c50',
    ground: '#123f38',
    groundAlt: '#1a4f45',
    sun: '#f5f3d0',
    sunPos: v3(150, 270, 400),
    ambient: 0.56,
    night: true,
    road: '#0c2e2a',
  },
  ridges: [
    { color: '#0c2e2a', z: 900, radius: 240, height: 150, count: 5 },
    { color: '#123f38', z: 560, radius: 180, height: 110, count: 6 },
  ],
  build: () =>
    scatter([
      { count: 5, zRange: [220, 620], make: () => tent(1, pick(['#0f766e', '#065f46', '#115e59'])), scale: [1.1, 1.7] },
      { count: 16, zRange: [70, 560], make: () => lantern(1, pick(['#fbbf24', '#fde68a', '#f59e0b'])), scale: [0.8, 1.4] },
    ]),
};

// ---------------------------------------------------------------------------
// Hanukkah — eight candles, blue-and-white night
// ---------------------------------------------------------------------------
const HANUKKAH: SeasonScene = {
  label: 'Hanukkah',
  palette: {
    skyTop: '#061a3a',
    skyHorizon: '#2f6fb0',
    fog: '#1c477a',
    ground: '#dbeafe',
    groundAlt: '#bfdbfe',
    sun: '#f8fafc',
    sunPos: v3(-160, 270, 400),
    ambient: 0.58,
    night: true,
    road: '#9db8d8',
  },
  ridges: [
    { color: '#123a68', z: 900, radius: 240, height: 150, count: 5 },
    { color: '#1c4d84', z: 560, radius: 180, height: 110, count: 6 },
  ],
  build: () =>
    scatter([
      { count: 7, zRange: [160, 560], make: () => menorah(1), scale: [1.2, 2] },
      { count: 10, zRange: [90, 620], make: () => pine(1, true), scale: [0.9, 1.6] },
    ]),
};

// ---------------------------------------------------------------------------
// Cinco de Mayo — fiesta street
// ---------------------------------------------------------------------------
const CINCO: SeasonScene = {
  label: 'Cinco de Mayo',
  palette: {
    skyTop: '#0d2f1a',
    skyHorizon: '#f2c14e',
    fog: '#7a9a4a',
    ground: '#3f7a2c',
    groundAlt: '#4c8c34',
    sun: '#fff0b0',
    sunPos: v3(150, 260, 420),
    ambient: 0.7,
    road: '#8a5a2b',
  },
  ridges: [
    { color: '#2f6b22', z: 1000, radius: 300, height: 120, count: 5 },
    { color: '#3a7a2a', z: 620, radius: 210, height: 85, count: 6 },
  ],
  build: () =>
    scatter([
      { count: 6, zRange: [180, 560], make: () => building({ w: 18, h: 15, d: 15, wall: '#e8d3a0', roof: '#c0392b', window: '#ffd166', windowGlow: 0.7, stories: 1, cols: 3 }), scale: [1.1, 1.6] },
      { count: 10, zRange: [80, 560], make: () => fiestaPole(1), scale: [1, 1.6] },
      { count: 6, zRange: [100, 460], make: () => blossomTree(1, pick(['#e11d48', '#22c55e', '#f59e0b'])), scale: [0.9, 1.4] },
    ]),
};

export const SCENES: Record<SceneKey, SeasonScene> = {
  halloween: HALLOWEEN,
  christmas: CHRISTMAS,
  stpatricks: STPATRICKS,
  newyear: NEWYEAR,
  valentines: VALENTINES,
  easter: EASTER,
  thanksgiving: THANKSGIVING,
  cny: CNY,
  midautumn: MIDAUTUMN,
  diwali: DIWALI,
  holi: HOLI,
  eidfitr: EID,
  eidadha: { ...EID, label: 'Eid al-Adha' },
  hanukkah: HANUKKAH,
  cincodemayo: CINCO,
};

export function sceneFor(theme: string | undefined): SeasonScene | undefined {
  if (!theme || theme === 'none') return undefined;
  return SCENES[theme as SceneKey];
}
