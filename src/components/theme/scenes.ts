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

// ---------------------------------------------------------------------------
// Seasons — additive only, so the year always has something on
// ---------------------------------------------------------------------------
const SPRING: SeasonScene = {
  label: 'Spring',
  ambient: 'none',
  palette: {
    skyTop: '#4aa3e0', skyHorizon: '#eafaf1', fog: '#cfeede',
    ground: '#68b95a', groundAlt: '#7fca6c', sun: '#fff6cf',
    sunPos: v3(-180, 290, 430), ambient: 0.8, road: '#c9a06a',
  },
  ridges: [
    { color: '#8cc97f', z: 1000, radius: 300, height: 120, count: 5 },
    { color: '#74ba66', z: 620, radius: 210, height: 80, count: 6 },
  ],
  build: () => scatter([
    { count: 14, zRange: [90, 700], make: () => blossomTree(1, pick(['#f9a8d4', '#fbcfe8', '#fda4af', '#fde68a'])), scale: [1, 1.7] },
    { count: 6, zRange: [160, 560], make: () => building({ w: 15, h: 13, d: 13, wall: '#fff7ed', roof: '#f472b6', window: '#fde68a', windowGlow: 0.5, stories: 1, cols: 2 }), scale: [1, 1.3] },
  ]),
};

const SUMMER: SeasonScene = {
  label: 'Summer',
  ambient: 'none',
  palette: {
    skyTop: '#2f8fdc', skyHorizon: '#fff4c2', fog: '#dcefff',
    ground: '#7cc96a', groundAlt: '#95d97f', sun: '#fff0a8',
    sunPos: v3(120, 320, 440), ambient: 0.92, road: '#d8b579',
  },
  ridges: [
    { color: '#8fce72', z: 1000, radius: 320, height: 110, count: 5 },
    { color: '#79bd5c', z: 620, radius: 220, height: 75, count: 6 },
  ],
  build: () => scatter([
    { count: 10, zRange: [90, 680], make: () => pine(1, false), scale: [0.9, 1.6] },
    { count: 8, zRange: [120, 560], make: () => building({ w: 16, h: 12, d: 14, wall: '#fdf2d0', roof: '#e08a3c', window: '#ffe9a8', windowGlow: 0.4, stories: 1, cols: 2 }), scale: [1, 1.4] },
  ]),
};

const AUTUMN: SeasonScene = {
  label: 'Autumn',
  ambient: 'none',
  palette: {
    skyTop: '#7a5a2a', skyHorizon: '#f2c37b', fog: '#cfa066',
    ground: '#a86a2c', groundAlt: '#bd7b38', sun: '#ffe1a3',
    sunPos: v3(-160, 270, 420), ambient: 0.68, road: '#7a4a22',
  },
  ridges: [
    { color: '#8a5622', z: 1000, radius: 300, height: 120, count: 5 },
    { color: '#9c6428', z: 620, radius: 210, height: 85, count: 6 },
  ],
  build: () => scatter([
    { count: 14, zRange: [90, 660], make: () => bareTree(1, '#6b3a1a'), scale: [1, 1.9] },
    { count: 6, zRange: [200, 560], make: () => building({ w: 18, h: 15, d: 15, wall: '#8a4a24', roof: '#5b2e12', window: '#ffca7a', windowGlow: 0.7, stories: 1, cols: 3 }), scale: [1.1, 1.6] },
  ]),
};

const WINTER: SeasonScene = {
  label: 'Winter',
  ambient: 'none',
  palette: {
    skyTop: '#0d2242', skyHorizon: '#5f83b5', fog: '#8fa9cc',
    ground: '#eaf2ff', groundAlt: '#cfe0f6', sun: '#f4f8ff',
    sunPos: v3(170, 260, 400), ambient: 0.62, night: true, road: '#b8c9de',
  },
  ridges: [
    { color: '#2a4a72', z: 980, radius: 250, height: 160, count: 6 },
    { color: '#35597f', z: 600, radius: 190, height: 115, count: 7 },
  ],
  build: () => scatter([
    { count: 16, zRange: [80, 720], make: () => pine(1, true), scale: [1, 2] },
    { count: 5, zRange: [200, 560], make: () => building({ w: 18, h: 20, d: 16, wall: '#3f4f66', roof: '#0e253f', window: '#fde68a', windowGlow: 0.8, stories: 2, cols: 2, snow: '#f4f8ff' }), scale: [1, 1.5] },
  ]),
};

// ---------------------------------------------------------------------------
// UK calendar moments
// ---------------------------------------------------------------------------
const MAYDAY: SeasonScene = {
  label: 'May Day',
  ambient: 'none',
  palette: {
    skyTop: '#3f9fd8', skyHorizon: '#fbe9ff', fog: '#dceff5',
    ground: '#63b054', groundAlt: '#7cc96a', sun: '#fff2c2',
    sunPos: v3(-150, 280, 420), ambient: 0.8, road: '#c9a06a',
  },
  ridges: [
    { color: '#7dbd78', z: 1000, radius: 300, height: 120, count: 5 },
    { color: '#66ac61', z: 620, radius: 210, height: 80, count: 6 },
  ],
  build: () => scatter([
    { count: 10, zRange: [80, 640], make: () => fiestaPole(1), scale: [1, 1.6] },
    { count: 10, zRange: [90, 660], make: () => blossomTree(1, pick(['#f9a8d4', '#fde68a', '#ffffff'])), scale: [1, 1.6] },
  ]),
};

const SPRINGBANK: SeasonScene = {
  label: 'Spring Bank Holiday',
  ambient: 'none',
  palette: {
    skyTop: '#4f8fd0', skyHorizon: '#eafaf0', fog: '#d3ead9',
    ground: '#5aab52', groundAlt: '#6fc063', sun: '#fff3c6',
    sunPos: v3(140, 290, 430), ambient: 0.82, road: '#b9975f',
  },
  ridges: [
    { color: '#6fb066', z: 1000, radius: 310, height: 125, count: 5 },
    { color: '#5ea056', z: 620, radius: 215, height: 85, count: 6 },
  ],
  build: () => scatter([
    { count: 12, zRange: [90, 660], make: () => pine(1, false), scale: [0.9, 1.7] },
    { count: 5, zRange: [200, 560], make: () => building({ w: 16, h: 14, d: 14, wall: '#e7d8b0', roof: '#6b4a2b', window: '#fde68a', windowGlow: 0.5, stories: 1, cols: 2 }), scale: [1, 1.3] },
  ]),
};

const SUMMERBANK: SeasonScene = {
  label: 'Summer Bank Holiday',
  ambient: 'none',
  palette: {
    skyTop: '#2f97d8', skyHorizon: '#fff0bf', fog: '#dceffb',
    ground: '#e6c98a', groundAlt: '#f0d79a', sun: '#fff0a8',
    sunPos: v3(130, 320, 440), ambient: 0.9, road: '#d8b579',
  },
  ridges: [
    { color: '#3f8fb0', z: 1000, radius: 340, height: 70, count: 5 },
    { color: '#4a9cbd', z: 620, radius: 240, height: 50, count: 6 },
  ],
  build: () => scatter([
    { count: 8, zRange: [90, 680], make: () => pine(1, false), scale: [0.8, 1.5] },
    { count: 6, zRange: [140, 560], make: () => tent(1, pick(['#e11d48', '#2563eb', '#f59e0b'])), scale: [1, 1.4] },
    { count: 6, zRange: [120, 520], make: () => fiestaPole(1), scale: [0.9, 1.4] },
  ]),
};

const FATHERSDAY: SeasonScene = {
  label: "Father's Day",
  ambient: 'none',
  palette: {
    skyTop: '#173a5e', skyHorizon: '#6fa8d6', fog: '#4a7aa6',
    ground: '#2f5d7a', groundAlt: '#3a6d8c', sun: '#ffe1a3',
    sunPos: v3(-150, 270, 420), ambient: 0.66, road: '#33506a',
  },
  ridges: [
    { color: '#244a68', z: 1000, radius: 300, height: 130, count: 5 },
    { color: '#2f5e7c', z: 620, radius: 210, height: 90, count: 6 },
  ],
  build: () => scatter([
    { count: 6, zRange: [200, 560], make: () => building({ w: 20, h: 16, d: 16, wall: '#c9b48a', roof: '#1e3a52', window: '#ffd166', windowGlow: 0.6, stories: 1, cols: 3 }), scale: [1.1, 1.6] },
    { count: 10, zRange: [80, 640], make: () => pine(1, false), scale: [0.9, 1.7] },
  ]),
};

const MOTHERSDAY: SeasonScene = {
  label: "Mother's Day",
  ambient: 'none',
  palette: {
    skyTop: '#b0538a', skyHorizon: '#ffd6e8', fog: '#e9a9c8',
    ground: '#7a2f56', groundAlt: '#8f3a64', sun: '#fff0f5',
    sunPos: v3(-140, 270, 410), ambient: 0.72, road: '#6a2548',
  },
  ridges: [
    { color: '#7a3a5e', z: 900, radius: 240, height: 130, count: 5 },
    { color: '#96486f', z: 560, radius: 180, height: 95, count: 6 },
  ],
  build: () => scatter([
    { count: 14, zRange: [90, 660], make: () => blossomTree(1, pick(['#f9a8d4', '#fbcfe8', '#fda4af'])), scale: [0.95, 1.6] },
    { count: 5, zRange: [240, 640], make: () => topiaryHeart(1), scale: [1, 1.5] },
  ]),
};

const PANCAKES: SeasonScene = {
  label: 'Pancake Day',
  ambient: 'none',
  palette: {
    skyTop: '#8a5a2a', skyHorizon: '#f6d27a', fog: '#d8a860',
    ground: '#b0762e', groundAlt: '#c68a3c', sun: '#fff0b0',
    sunPos: v3(140, 270, 420), ambient: 0.72, road: '#8a5a2b',
  },
  ridges: [
    { color: '#94622a', z: 1000, radius: 300, height: 115, count: 5 },
    { color: '#a86e30', z: 620, radius: 210, height: 80, count: 6 },
  ],
  build: () => scatter([
    { count: 6, zRange: [200, 560], make: () => building({ w: 18, h: 15, d: 15, wall: '#f3d9a0', roof: '#8a4a24', window: '#ffd166', windowGlow: 0.7, stories: 1, cols: 3 }), scale: [1.1, 1.6] },
    { count: 10, zRange: [80, 620], make: () => lantern(1, pick(['#f5a524', '#eab308', '#fbbf24'])), scale: [0.8, 1.4] },
  ]),
};

const STGEORGE: SeasonScene = {
  label: "St. George's Day",
  ambient: 'none',
  palette: {
    skyTop: '#8a1420', skyHorizon: '#f2c1c8', fog: '#c46f78',
    ground: '#4a7a3a', groundAlt: '#5a8a48', sun: '#fff0f0',
    sunPos: v3(-150, 280, 420), ambient: 0.72, road: '#7a4a2b',
  },
  ridges: [
    { color: '#6b2430', z: 1000, radius: 300, height: 120, count: 5 },
    { color: '#7d2f3c', z: 620, radius: 210, height: 85, count: 6 },
  ],
  build: () => scatter([
    { count: 10, zRange: [80, 640], make: () => blossomTree(1, pick(['#fca5a5', '#ffffff', '#ef4444'])), scale: [1, 1.7] },
    { count: 5, zRange: [200, 560], make: () => building({ w: 16, h: 14, d: 14, wall: '#f3e3d0', roof: '#8a1420', window: '#fde68a', windowGlow: 0.5, stories: 1, cols: 2 }), scale: [1, 1.3] },
  ]),
};

const APRILFOOLS: SeasonScene = {
  label: "April Fool's Day",
  ambient: 'none',
  palette: {
    skyTop: '#5b2a8a', skyHorizon: '#ffd166', fog: '#b98fd8',
    ground: '#6a3fa0', groundAlt: '#7d4fb4', sun: '#fff2a8',
    sunPos: v3(-140, 270, 420), ambient: 0.78, road: '#6a2f9c',
  },
  ridges: [
    { color: '#5b2a7a', z: 1000, radius: 300, height: 125, count: 5 },
    { color: '#6d368c', z: 620, radius: 210, height: 88, count: 6 },
  ],
  build: () => scatter([
    { count: 10, zRange: [80, 620], make: () => fiestaPole(1), scale: [1, 1.5] },
    { count: 8, zRange: [90, 640], make: () => blossomTree(1, pick(['#a3e635', '#fbbf24', '#38bdf8', '#f472b6'])), scale: [1, 1.5] },
  ]),
};

const EARTHDAY: SeasonScene = {
  label: 'Earth Day',
  ambient: 'none',
  palette: {
    skyTop: '#2f8f6a', skyHorizon: '#d6f5e0', fog: '#a7ddc0',
    ground: '#3f8f4e', groundAlt: '#4fa45c', sun: '#fffbe0',
    sunPos: v3(-160, 290, 430), ambient: 0.82, road: '#6b4a2b',
  },
  ridges: [
    { color: '#2f7a42', z: 1000, radius: 310, height: 120, count: 5 },
    { color: '#3a8c4c', z: 620, radius: 215, height: 85, count: 6 },
  ],
  build: () => scatter([
    { count: 14, zRange: [90, 680], make: () => pine(1, false), scale: [0.9, 1.8] },
    { count: 8, zRange: [90, 620], make: () => blossomTree(1, pick(['#86efac', '#fde68a', '#ffffff'])), scale: [0.9, 1.5] },
  ]),
};

const BACKTOSCHOOL: SeasonScene = {
  label: 'Back to School',
  ambient: 'none',
  palette: {
    skyTop: '#3a5a8a', skyHorizon: '#f2c88f', fog: '#b98f66',
    ground: '#8a6a2c', groundAlt: '#9c7a34', sun: '#ffe6b0',
    sunPos: v3(150, 270, 420), ambient: 0.72, road: '#6a4a22',
  },
  ridges: [
    { color: '#6a5222', z: 1000, radius: 300, height: 115, count: 5 },
    { color: '#7a6028', z: 620, radius: 210, height: 80, count: 6 },
  ],
  build: () => scatter([
    { count: 6, zRange: [200, 560], make: () => building({ w: 22, h: 18, d: 18, wall: '#cbbb90', roof: '#3a4a66', window: '#ffd166', windowGlow: 0.7, stories: 2, cols: 3 }), scale: [1.2, 1.7] },
    { count: 12, zRange: [80, 640], make: () => bareTree(1, '#6b4a1a'), scale: [1, 1.7] },
  ]),
};

const BONFIRE: SeasonScene = {
  label: 'Bonfire Night',
  ambient: 'fireworks',
  palette: {
    skyTop: '#0a0716', skyHorizon: '#3a2050', fog: '#2a1a3a',
    ground: '#1a1430', groundAlt: '#241c3d', sun: '#ffcf8a',
    sunPos: v3(-140, 250, 420), ambient: 0.44, night: true, road: '#120d24',
  },
  ridges: [
    { color: '#120c22', z: 980, radius: 260, height: 180, count: 6 },
    { color: '#1c1433', z: 600, radius: 190, height: 125, count: 7 },
  ],
  build: () => scatter([
    { count: 6, zRange: [150, 430], make: () => building({ w: 22, h: 30, d: 18, wall: '#2a2340', roof: '#161028', window: '#ffb347', windowGlow: 0.6, stories: 3, cols: 2 }), scale: [1.1, 1.7] },
    { count: 12, zRange: [80, 620], make: () => bareTree(1, '#241d33'), scale: [1.1, 2] },
    { count: 20, zRange: [70, 520], make: () => lantern(1, pick(['#f97316', '#fbbf24', '#ef4444'])), scale: [0.8, 1.4] },
  ]),
};

const REMEMBRANCE: SeasonScene = {
  label: 'Remembrance Day',
  ambient: 'none',
  palette: {
    skyTop: '#4a3a3a', skyHorizon: '#c9b8b0', fog: '#a08a84',
    ground: '#5a4a3a', groundAlt: '#6b584a', sun: '#f0e0d0',
    sunPos: v3(-150, 260, 420), ambient: 0.6, road: '#4a3a2a',
  },
  ridges: [
    { color: '#4a3a32', z: 980, radius: 260, height: 150, count: 6 },
    { color: '#5c4a40', z: 600, radius: 190, height: 105, count: 7 },
  ],
  build: () => scatter([
    { count: 8, zRange: [160, 560], make: () => gravestone(1), scale: [1, 1.6] },
    { count: 16, zRange: [80, 620], make: () => blossomTree(1, pick(['#dc2626', '#b91c1c', '#f87171'])), scale: [0.8, 1.4] },
  ]),
};

const BOXINGDAY: SeasonScene = {
  label: 'Boxing Day',
  ambient: 'none',
  palette: {
    skyTop: '#050d22', skyHorizon: '#2b4a72', fog: '#2c4562',
    ground: '#e8f0ff', groundAlt: '#c9dcf6', sun: '#f4f8ff',
    sunPos: v3(190, 250, 380), ambient: 0.58, night: true, road: '#aebfd8',
  },
  ridges: [
    { color: '#1c3050', z: 980, radius: 250, height: 170, count: 6 },
    { color: '#26405c', z: 600, radius: 190, height: 120, count: 7 },
  ],
  build: () => scatter([
    { count: 6, zRange: [150, 430], make: () => building({ w: 22, h: 32, d: 18, wall: '#5b3a24', roof: '#0e7490', window: '#fbbf24', windowGlow: 0.9, stories: 3, cols: 2, snow: '#f4f8ff' }), scale: [1.1, 1.7] },
    { count: 14, zRange: [70, 720], make: () => pine(1, true), scale: [1, 2] },
  ]),
};

// ---------------------------------------------------------------------------
// Shopping / growth moments
// ---------------------------------------------------------------------------
const JANUARYSALES: SeasonScene = {
  label: 'January Sales',
  ambient: 'none',
  palette: {
    skyTop: '#0d1a3a', skyHorizon: '#4a6a9a', fog: '#39517a',
    ground: '#123a2c', groundAlt: '#1a4a38', sun: '#fdf0c0',
    sunPos: v3(140, 260, 400), ambient: 0.6, night: true, road: '#0f2038',
  },
  ridges: [
    { color: '#12294a', z: 980, radius: 250, height: 165, count: 6 },
    { color: '#1a3557', z: 600, radius: 190, height: 118, count: 7 },
  ],
  build: () => scatter([
    { count: 7, zRange: [150, 460], make: () => building({ w: 20, h: 40, d: 18, wall: '#1b2a48', roof: '#0a1230', window: '#ffd166', windowGlow: 0.8, stories: 5, cols: 2 }), scale: [1.1, 1.7] },
    { count: 14, zRange: [70, 620], make: () => lantern(1, pick(['#fbbf24', '#facc15', '#fde68a'])), scale: [0.8, 1.4] },
  ]),
};

const BLACKFRIDAY: SeasonScene = {
  label: 'Black Friday',
  ambient: 'none',
  palette: {
    skyTop: '#050508', skyHorizon: '#2a2a2f', fog: '#1c1c22',
    ground: '#141418', groundAlt: '#1e1e24', sun: '#ffe066',
    sunPos: v3(-150, 250, 410), ambient: 0.46, night: true, road: '#0e0e12',
  },
  ridges: [
    { color: '#101014', z: 980, radius: 250, height: 190, count: 6 },
    { color: '#1a1a20', z: 600, radius: 190, height: 135, count: 7 },
  ],
  build: () => scatter([
    { count: 7, zRange: [150, 460], make: () => building({ w: 20, h: 44, d: 18, wall: '#1a1a22', roof: '#08080c', window: '#ffd166', windowGlow: 0.75, stories: 6, cols: 2 }), scale: [1.1, 1.7] },
    { count: 12, zRange: [80, 560], make: () => lantern(1, pick(['#fbbf24', '#facc15', '#fde047'])), scale: [0.8, 1.4] },
  ]),
};

const CYBERMONDAY: SeasonScene = {
  label: 'Cyber Monday',
  ambient: 'none',
  palette: {
    skyTop: '#050b1e', skyHorizon: '#1c3a6a', fog: '#152a4a',
    ground: '#0a1226', groundAlt: '#12203f', sun: '#66d9ff',
    sunPos: v3(150, 260, 400), ambient: 0.48, night: true, road: '#08101f',
  },
  ridges: [
    { color: '#0c1a34', z: 980, radius: 250, height: 185, count: 6 },
    { color: '#142a4d', z: 600, radius: 190, height: 132, count: 7 },
  ],
  build: () => scatter([
    { count: 7, zRange: [150, 460], make: () => building({ w: 20, h: 42, d: 18, wall: '#152344', roof: '#08101f', window: '#67e8f9', windowGlow: 0.8, stories: 6, cols: 2 }), scale: [1.1, 1.7] },
    { count: 12, zRange: [80, 560], make: () => lantern(1, pick(['#22d3ee', '#38bdf8', '#67e8f9'])), scale: [0.8, 1.4] },
  ]),
};

const SMALLBIZ: SeasonScene = {
  label: 'Small Business Saturday',
  ambient: 'none',
  palette: {
    skyTop: '#173a5e', skyHorizon: '#8fb0d6', fog: '#5a7fa6',
    ground: '#2f5d5a', groundAlt: '#3a6d68', sun: '#ffe9b0',
    sunPos: v3(-150, 270, 420), ambient: 0.66, road: '#3a5050',
  },
  ridges: [
    { color: '#24485a', z: 1000, radius: 300, height: 130, count: 5 },
    { color: '#2f5a68', z: 620, radius: 210, height: 90, count: 6 },
  ],
  build: () => scatter([
    { count: 7, zRange: [180, 560], make: () => building({ w: 18, h: 15, d: 15, wall: '#e8d3a0', roof: '#1e4a52', window: '#ffd166', windowGlow: 0.75, stories: 1, cols: 3 }), scale: [1.1, 1.6] },
    { count: 10, zRange: [80, 600], make: () => lantern(1, pick(['#fbbf24', '#f59e0b', '#fde68a'])), scale: [0.8, 1.4] },
  ]),
};

// ---------------------------------------------------------------------------
// Faith / cultural additions
// ---------------------------------------------------------------------------
const RAMADAN: SeasonScene = {
  label: 'Ramadan',
  ambient: 'none',
  palette: {
    skyTop: '#04161c', skyHorizon: '#1f6f7a', fog: '#134a52',
    ground: '#0f3038', groundAlt: '#164048', sun: '#f5f3d0',
    sunPos: v3(150, 270, 400), ambient: 0.5, night: true, road: '#0a222a',
  },
  ridges: [
    { color: '#0a222a', z: 900, radius: 240, height: 150, count: 5 },
    { color: '#0f3038', z: 560, radius: 180, height: 110, count: 6 },
  ],
  build: () => scatter([
    { count: 6, zRange: [220, 620], make: () => pagoda(1), scale: [1, 1.6] },
    { count: 18, zRange: [70, 560], make: () => lantern(1, pick(['#fbbf24', '#fde68a', '#5eead4'])), scale: [0.8, 1.4] },
  ]),
};

const DUSSEHRA: SeasonScene = {
  label: 'Dussehra',
  ambient: 'fireworks',
  palette: {
    skyTop: '#2a0a2e', skyHorizon: '#a8462f', fog: '#6a2a2a',
    ground: '#4a1a20', groundAlt: '#5c2428', sun: '#ffd27a',
    sunPos: v3(140, 250, 400), ambient: 0.52, night: true, road: '#3a1218',
  },
  ridges: [
    { color: '#3a1218', z: 900, radius: 240, height: 150, count: 5 },
    { color: '#4a1a20', z: 560, radius: 180, height: 110, count: 6 },
  ],
  build: () => scatter([
    { count: 5, zRange: [220, 620], make: () => pagoda(1), scale: [1, 1.8] },
    { count: 20, zRange: [70, 560], make: () => lantern(1, pick(['#fbbf24', '#f97316', '#fca5a5'])), scale: [0.8, 1.4] },
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
  spring: SPRING,
  summer: SUMMER,
  autumn: AUTUMN,
  winter: WINTER,
  mayday: MAYDAY,
  springbank: SPRINGBANK,
  summerbank: SUMMERBANK,
  fathersday: FATHERSDAY,
  mothersday: MOTHERSDAY,
  pancakes: PANCAKES,
  stgeorge: STGEORGE,
  aprilsfools: APRILFOOLS,
  earthday: EARTHDAY,
  backtoschool: BACKTOSCHOOL,
  bonfirenight: BONFIRE,
  remembranceday: REMEMBRANCE,
  boxingday: BOXINGDAY,
  januarysales: JANUARYSALES,
  blackfriday: BLACKFRIDAY,
  cybermonday: CYBERMONDAY,
  smallbusinesssaturday: SMALLBIZ,
  ramadan: RAMADAN,
  dussehra: DUSSEHRA,
};

export function sceneFor(theme: string | undefined): SeasonScene | undefined {
  if (!theme || theme === 'none') return undefined;
  return SCENES[theme as SceneKey];
}
