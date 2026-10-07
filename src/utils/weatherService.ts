/**
 * Live riding-weather service.
 *
 * Resolves the rider's area (device geolocation with a graceful fallback to the
 * workshop), fetches a real 7-day forecast from Open-Meteo (no API key, CORS
 * enabled) and turns it into "can I ride?" guidance. Everything that is not a
 * network call is pure so it can be unit-tested without a browser.
 */

export type WeatherKind =
  | 'clear'
  | 'partly'
  | 'cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavy_rain'
  | 'sleet'
  | 'snow'
  | 'showers'
  | 'thunder';

export type RidingGrade = 'excellent' | 'good' | 'fair' | 'poor' | 'hazardous';

export interface WeatherLocation {
  latitude: number;
  longitude: number;
  /** Human area name, e.g. "Salford". */
  label: string;
  source: 'device' | 'default' | 'manual';
}

export interface DailyWeather {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Short weekday, e.g. "Mon". */
  weekday: string;
  weatherCode: number;
  kind: WeatherKind;
  label: string;
  tempMax: number;
  tempMin: number;
  /** 0-100. */
  precipProb: number;
  precipMm: number;
  windMaxKph: number;
  windGustKph: number;
  uvMax: number;
  sunrise: string;
  sunset: string;
}

export interface CurrentWeather {
  tempC: number;
  feelsLikeC: number;
  weatherCode: number;
  kind: WeatherKind;
  label: string;
  windKph: number;
  precipMm: number;
  isDay: boolean;
}

export interface RidingConditions {
  score: number;
  grade: RidingGrade;
  headline: string;
  advisories: string[];
}

export interface WeatherReport {
  location: WeatherLocation;
  fetchedAt: number;
  timezone: string;
  current: CurrentWeather;
  days: DailyWeather[];
  /** True when this is the deterministic offline fallback, not live data. */
  synthetic: boolean;
}

export const WEATHER_CACHE_KEY = 'stakeys.weather.v1';
export const WEATHER_TTL_MS = 30 * 60 * 1000;

/** The workshop's home patch — used when a rider declines location access. */
export const DEFAULT_WEATHER_LOCATION: WeatherLocation = {
  latitude: 53.4875,
  longitude: -2.2901,
  label: 'Salford, Manchester',
  source: 'default',
};

/** A handful of UK towns so a coordinate can be named without a network call. */
const KNOWN_AREAS: { name: string; lat: number; lon: number }[] = [
  { name: 'Salford', lat: 53.4875, lon: -2.2901 },
  { name: 'Manchester', lat: 53.4808, lon: -2.2426 },
  { name: 'Bolton', lat: 53.578, lon: -2.428 },
  { name: 'Stockport', lat: 53.4106, lon: -2.1575 },
  { name: 'Oldham', lat: 53.5409, lon: -2.1114 },
  { name: 'Wigan', lat: 53.545, lon: -2.632 },
  { name: 'Warrington', lat: 53.39, lon: -2.597 },
  { name: 'Liverpool', lat: 53.4084, lon: -2.9916 },
  { name: 'Leeds', lat: 53.8008, lon: -1.5491 },
  { name: 'Sheffield', lat: 53.3811, lon: -1.4701 },
  { name: 'Birmingham', lat: 52.4862, lon: -1.8904 },
  { name: 'Nottingham', lat: 52.9548, lon: -1.1581 },
  { name: 'Bristol', lat: 51.4545, lon: -2.5879 },
  { name: 'Cardiff', lat: 51.4816, lon: -3.1791 },
  { name: 'Newcastle', lat: 54.9783, lon: -1.6178 },
  { name: 'Glasgow', lat: 55.8642, lon: -4.2518 },
  { name: 'Edinburgh', lat: 55.9533, lon: -3.1883 },
  { name: 'London', lat: 51.5074, lon: -0.1278 },
];

/** Nearest named area to a coordinate, or null when nothing is close enough. */
export function nearestAreaName(lat: number, lon: number): string | null {
  let best: { name: string; d: number } | null = null;
  for (const area of KNOWN_AREAS) {
    const d = Math.hypot(area.lat - lat, area.lon - lon);
    if (!best || d < best.d) best = { name: area.name, d };
  }
  // ~0.6 degrees (~65 km) keeps a wrong city from being confidently reported.
  return best && best.d <= 0.6 ? best.name : null;
}

/** WMO weather interpretation codes -> a coarse, rideable condition. */
export function weatherKindFor(code: number): WeatherKind {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 55) return 'drizzle';
  if (code === 56 || code === 57 || code === 66 || code === 67) return 'sleet';
  if (code === 61 || code === 63 || code === 80 || code === 81) return 'rain';
  if (code === 65 || code === 82) return 'heavy_rain';
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return 'snow';
  if (code === 95 || code === 96 || code === 99) return 'thunder';
  return 'cloudy';
}

export function weatherLabel(kind: WeatherKind): string {
  const labels: Record<WeatherKind, string> = {
    clear: 'Clear',
    partly: 'Partly cloudy',
    cloudy: 'Cloudy',
    overcast: 'Overcast',
    fog: 'Fog',
    drizzle: 'Drizzle',
    rain: 'Rain',
    heavy_rain: 'Heavy rain',
    sleet: 'Sleet',
    snow: 'Snow',
    showers: 'Showers',
    thunder: 'Thunderstorms',
  };
  return labels[kind];
}

export function weatherEmoji(kind: WeatherKind): string {
  const map: Record<WeatherKind, string> = {
    clear: '☀️',
    partly: '⛅',
    cloudy: '☁️',
    overcast: '🌥️',
    fog: '🌫️',
    drizzle: '🌦️',
    rain: '🌧️',
    heavy_rain: '⛈️',
    sleet: '🌨️',
    snow: '❄️',
    showers: '🌦️',
    thunder: '⛈️',
  };
  return map[kind];
}

export function isPrecipKind(kind: WeatherKind): boolean {
  return ['drizzle', 'rain', 'heavy_rain', 'sleet', 'snow', 'showers', 'thunder'].includes(kind);
}

/** Rounds to a fixed number of decimals without the 1.005 mis-round. */
function round(value: number, dp = 0): number {
  if (!Number.isFinite(value)) return 0;
  const shift = 10 ** dp;
  return Math.round((value + Number.EPSILON) * shift) / shift;
}

/** Local date as YYYY-MM-DD, so "today" never drifts across timezones. */
export function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function weekdayShort(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(d);
}

/** "Today" / "Tomorrow" / "Wed" so the strip reads naturally. */
export function dayLabel(dateStr: string, now: Date = new Date()): string {
  const today = localDateKey(now);
  const tomorrow = localDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  if (dateStr === today) return 'Today';
  if (dateStr === tomorrow) return 'Tomorrow';
  return weekdayShort(dateStr);
}

/**
 * The "can I ride?" score for a single day. Starts at 100 and deducts for the
 * things that actually make cycling miserable or dangerous: ice, heavy rain,
 * gusty wind, storms and extreme heat.
 */
export function ridingConditionsFor(day: DailyWeather): RidingConditions {
  let score = 100;
  const advisories: string[] = [];

  score -= day.precipProb * 0.35;
  score -= Math.min(day.precipMm, 20) * 1.1;

  if (day.windMaxKph > 25) {
    score -= (day.windMaxKph - 25) * 1.1;
    advisories.push('Breezy — allow extra time on exposed routes.');
  }
  if (day.windGustKph > 40) {
    score -= (day.windGustKph - 40) * 0.8;
    advisories.push('Strong gusts — take care in crosswinds and on bridges.');
  }

  if (day.tempMin <= 0) {
    score -= 22;
    advisories.push('Ice risk on the roads — go steady and watch shaded corners.');
  } else if (day.tempMin <= 3) {
    score -= 10;
    advisories.push('Cold start — layers, gloves and a check on your brakes.');
  }
  if (day.tempMax >= 34) {
    score -= 24;
    advisories.push('Very hot — ride early or late, carry water.');
  } else if (day.tempMax >= 29) {
    score -= 12;
    advisories.push('Warm — take water and pace yourself.');
  }

  switch (day.kind) {
    case 'thunder':
      score -= 42;
      advisories.push('Thunderstorms forecast — consider postponing the ride.');
      break;
    case 'heavy_rain':
      score -= 22;
      advisories.push('Heavy rain — waterproofs, lights and expect reduced braking.');
      break;
    case 'snow':
      score -= 34;
      advisories.push('Snow — traction is poor; only ride if you must.');
      break;
    case 'sleet':
      score -= 26;
      advisories.push('Sleet — cold, wet and slippery underfoot.');
      break;
    case 'fog':
      score -= 16;
      advisories.push('Fog — use lights and ride to be seen.');
      break;
    case 'rain':
    case 'showers':
      score -= 8;
      advisories.push('Showers about — pack a waterproof.');
      break;
    case 'drizzle':
      score -= 4;
      break;
    default:
      break;
  }

  if (day.uvMax >= 8) {
    score -= 6;
    advisories.push('High UV — sunscreen on exposed skin.');
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const grade: RidingGrade =
    clamped >= 80 ? 'excellent' : clamped >= 62 ? 'good' : clamped >= 45 ? 'fair' : clamped >= 28 ? 'poor' : 'hazardous';

  return { score: clamped, grade, headline: ridingHeadline(grade, day.kind), advisories };
}

export function ridingHeadline(grade: RidingGrade, kind: WeatherKind): string {
  if (grade === 'excellent') return `Great day to ride — ${weatherLabel(kind).toLowerCase()}.`;
  if (grade === 'good') return 'Good riding conditions.';
  if (grade === 'fair') return 'Rideable, but dress for the weather.';
  if (grade === 'poor') return 'Tough conditions — only ride if you need to.';
  return 'Hazardous — leave the bike at home if you can.';
}

export const RIDING_GRADE_LABEL: Record<RidingGrade, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  hazardous: 'Hazardous',
};

/** Index of the best riding day in the week (ties go to the earliest day). */
export function pickBestRidingDay(days: DailyWeather[]): number {
  let bestIdx = 0;
  let bestScore = -1;
  days.forEach((day, i) => {
    const { score } = ridingConditionsFor(day);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });
  return bestIdx;
}

export function buildOpenMeteoUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset',
    timezone: 'auto',
    forecast_days: '7',
    wind_speed_unit: 'kmh',
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/** Turns an Open-Meteo forecast response into our report shape. */
export function parseOpenMeteo(data: any, location: WeatherLocation, now: number = Date.now()): WeatherReport {
  const daily = data?.daily ?? {};
  const times: string[] = daily.time ?? [];
  const num = (arr: any[], i: number, fallback = 0) => {
    const v = Number(arr?.[i]);
    return Number.isFinite(v) ? v : fallback;
  };

  const days: DailyWeather[] = times.map((date, i) => {
    const code = num(daily.weather_code, i);
    const kind = weatherKindFor(code);
    return {
      date,
      weekday: weekdayShort(date),
      weatherCode: code,
      kind,
      label: weatherLabel(kind),
      tempMax: round(num(daily.temperature_2m_max, i)),
      tempMin: round(num(daily.temperature_2m_min, i)),
      precipProb: round(num(daily.precipitation_probability_max, i)),
      precipMm: round(num(daily.precipitation_sum, i), 1),
      windMaxKph: round(num(daily.wind_speed_10m_max, i)),
      windGustKph: round(num(daily.wind_gusts_10m_max, i)),
      uvMax: round(num(daily.uv_index_max, i), 1),
      sunrise: String(daily.sunrise?.[i] ?? ''),
      sunset: String(daily.sunset?.[i] ?? ''),
    };
  });

  const cur = data?.current ?? {};
  const currentCode = num([cur.weather_code], 0);
  const currentKind = weatherKindFor(currentCode);

  return {
    location,
    fetchedAt: now,
    timezone: String(data?.timezone ?? 'Europe/London'),
    current: {
      tempC: round(num([cur.temperature_2m], 0)),
      feelsLikeC: round(num([cur.apparent_temperature], 0, num([cur.temperature_2m], 0))),
      weatherCode: currentCode,
      kind: currentKind,
      label: weatherLabel(currentKind),
      windKph: round(num([cur.wind_speed_10m], 0)),
      precipMm: round(num([cur.precipitation], 0), 1),
      isDay: cur.is_day === 0 ? false : cur.is_day === 1 ? true : true,
    },
    days,
    synthetic: false,
  };
}

export interface FetchWeatherOptions {
  now?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Fetches the live 7-day forecast. Throws on network/HTTP failure. */
export async function fetchWeatherReport(
  location: WeatherLocation,
  opts: FetchWeatherOptions = {}
): Promise<WeatherReport> {
  const doFetch = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), opts.timeoutMs ?? 9000)
    : null;

  try {
    const res = await doFetch(buildOpenMeteoUrl(location.latitude, location.longitude), {
      signal: controller?.signal,
    });
    if (!res.ok) throw new Error(`Weather service returned ${res.status}`);
    const data = await res.json();
    const report = parseOpenMeteo(data, location, now);
    if (!report.days.length) throw new Error('Weather service returned no forecast');
    return report;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * A deterministic offline forecast so the UI still renders (and tests can run)
 * when the network is unavailable. Marks itself `synthetic` so the UI can say so.
 */
export function syntheticWeatherReport(
  location: WeatherLocation = DEFAULT_WEATHER_LOCATION,
  now: Date = new Date()
): WeatherReport {
  const kinds: WeatherKind[] = ['partly', 'rain', 'overcast', 'clear', 'showers', 'cloudy', 'clear'];
  const days: DailyWeather[] = kinds.map((kind, i) => {
    const date = localDateKey(new Date(now.getTime() + i * 24 * 60 * 60 * 1000));
    const base = 12 + (i % 3) * 2;
    return {
      date,
      weekday: weekdayShort(date),
      weatherCode: 3,
      kind,
      label: weatherLabel(kind),
      tempMax: base + 4,
      tempMin: base - 3,
      precipProb: kind === 'rain' ? 80 : kind === 'showers' ? 55 : kind === 'overcast' ? 30 : 10,
      precipMm: kind === 'rain' ? 4.2 : kind === 'showers' ? 1.4 : 0,
      windMaxKph: 14 + i * 2,
      windGustKph: 26 + i * 3,
      uvMax: 2,
      sunrise: '',
      sunset: '',
    };
  });
  return {
    location,
    fetchedAt: now.getTime(),
    timezone: 'Europe/London',
    current: {
      tempC: days[0].tempMax - 2,
      feelsLikeC: days[0].tempMax - 3,
      weatherCode: 2,
      kind: 'partly',
      label: weatherLabel('partly'),
      windKph: 12,
      precipMm: 0,
      isDay: true,
    },
    days,
    synthetic: true,
  };
}

export interface CachedWeather {
  report: WeatherReport;
  cachedAt: number;
}

export function loadCachedWeather(storage?: Storage | null): WeatherReport | null {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return null;
  try {
    const raw = store.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWeather;
    if (!parsed?.report?.days?.length) return null;
    if (Date.now() - parsed.cachedAt > WEATHER_TTL_MS) return null;
    return parsed.report;
  } catch {
    return null;
  }
}

export function saveCachedWeather(report: WeatherReport, storage?: Storage | null): void {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return;
  try {
    store.setItem(WEATHER_CACHE_KEY, JSON.stringify({ report, cachedAt: Date.now() }));
  } catch {
    /* quota / private mode — caching is best-effort */
  }
}

/**
 * Resolves the area to forecast for: the device's location when the rider
 * allows it, otherwise the workshop. Always returns a usable location.
 */
export interface GeoResult {
  latitude: number;
  longitude: number;
}

/** Wraps the browser geolocation API in a promise that never rejects. */
export function getBrowserLocation(timeoutMs = 8000): Promise<GeoResult | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    let settled = false;
    const done = (value: GeoResult | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        done({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        done(null);
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 10 * 60 * 1000 }
    );
  });
}

/** Best-effort area name for a coordinate via a free, key-less reverse geocoder. */
export async function reverseGeocodeArea(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    const data = await res.json();
    const name = data?.city || data?.locality || data?.principalSubdivision || null;
    return name ? String(name) : null;
  } catch {
    return null;
  }
}

export interface ResolveLocationOptions {
  allowDevice?: boolean;
  fetchImpl?: typeof fetch;
}

/**
 * Resolves the area to forecast for: the device's location when the rider
 * allows it, otherwise the workshop. Always returns a usable location.
 */
export async function resolveWeatherLocation(
  opts: ResolveLocationOptions = {}
): Promise<WeatherLocation> {
  if (opts.allowDevice !== false) {
    const geo = await getBrowserLocation();
    if (geo) {
      const label =
        (await reverseGeocodeArea(geo.latitude, geo.longitude, opts.fetchImpl ?? fetch)) ||
        nearestAreaName(geo.latitude, geo.longitude) ||
        'Your area';
      return { ...geo, label, source: 'device' };
    }
  }
  return DEFAULT_WEATHER_LOCATION;
}
