import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_WEATHER_LOCATION,
  buildOpenMeteoUrl,
  dayLabel,
  fetchWeatherReport,
  loadCachedWeather,
  localDateKey,
  nearestAreaName,
  parseOpenMeteo,
  pickBestRidingDay,
  resolveWeatherLocation,
  reverseGeocodeArea,
  ridingConditionsFor,
  saveCachedWeather,
  syntheticWeatherReport,
  weatherKindFor,
  weatherLabel,
  WEATHER_CACHE_KEY,
  DailyWeather,
} from './src/utils/weatherService';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
  localStorage.clear();
});

function makeDay(overrides: Partial<DailyWeather> = {}): DailyWeather {
  return {
    date: '2026-10-06',
    weekday: 'Mon',
    weatherCode: 0,
    kind: 'clear',
    label: 'Clear',
    tempMax: 18,
    tempMin: 10,
    precipProb: 0,
    precipMm: 0,
    windMaxKph: 8,
    windGustKph: 15,
    uvMax: 3,
    sunrise: '2026-10-06T07:12',
    sunset: '2026-10-06T18:40',
    ...overrides,
  };
}

/** A realistic Open-Meteo response with 7 forecast days. */
function openMeteoFixture() {
  const time = ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12'];
  return {
    timezone: 'Europe/London',
    current: {
      temperature_2m: 13.4,
      apparent_temperature: 11.9,
      is_day: 1,
      precipitation: 0.2,
      weather_code: 3,
      wind_speed_10m: 14.2,
    },
    daily: {
      time,
      weather_code: [3, 61, 0, 80, 2, 95, 45],
      temperature_2m_max: [16.1, 14.2, 18.9, 15.5, 17.0, 13.3, 12.8],
      temperature_2m_min: [9.4, 8.1, 11.2, 7.6, 10.1, 6.9, 5.4],
      precipitation_sum: [0.4, 5.2, 0, 2.1, 0.1, 8.8, 0],
      precipitation_probability_max: [30, 85, 5, 60, 20, 95, 15],
      wind_speed_10m_max: [18, 34, 12, 27, 20, 46, 15],
      wind_gusts_10m_max: [30, 55, 20, 44, 33, 72, 26],
      uv_index_max: [2.4, 1.1, 3.6, 1.8, 2.9, 0.7, 1.2],
      sunrise: time.map((d) => `${d}T07:10`),
      sunset: time.map((d) => `${d}T18:35`),
    },
  };
}

describe('weather codes', () => {
  it('maps WMO codes to rideable kinds', () => {
    expect(weatherKindFor(0)).toBe('clear');
    expect(weatherKindFor(2)).toBe('partly');
    expect(weatherKindFor(3)).toBe('overcast');
    expect(weatherKindFor(45)).toBe('fog');
    expect(weatherKindFor(53)).toBe('drizzle');
    expect(weatherKindFor(61)).toBe('rain');
    expect(weatherKindFor(65)).toBe('heavy_rain');
    expect(weatherKindFor(66)).toBe('sleet');
    expect(weatherKindFor(75)).toBe('snow');
    expect(weatherKindFor(95)).toBe('thunder');
    expect(weatherKindFor(1234)).toBe('cloudy');
  });

  it('labels every kind', () => {
    expect(weatherLabel('heavy_rain')).toBe('Heavy rain');
    expect(weatherLabel('thunder')).toBe('Thunderstorms');
  });
});

describe('riding conditions', () => {
  it('gives a clear, calm day an excellent grade', () => {
    const c = ridingConditionsFor(makeDay());
    expect(c.grade).toBe('excellent');
    expect(c.score).toBeGreaterThanOrEqual(80);
    expect(c.advisories).toHaveLength(0);
  });

  it('flags ice, storms and gales as hazardous/poor with advisories', () => {
    const storm = ridingConditionsFor(
      makeDay({ kind: 'thunder', weatherCode: 95, precipProb: 95, precipMm: 9, windGustKph: 72, tempMin: -1 })
    );
    expect(['poor', 'hazardous']).toContain(storm.grade);
    expect(storm.advisories.join(' ')).toMatch(/Thunderstorms/);
    expect(storm.advisories.join(' ')).toMatch(/Ice/);
  });

  it('is deterministic for the same input', () => {
    const day = makeDay({ kind: 'rain', precipProb: 70, windMaxKph: 30 });
    expect(ridingConditionsFor(day).score).toBe(ridingConditionsFor(day).score);
  });

  it('picks the highest-scoring day as best', () => {
    const days = [
      makeDay({ date: '2026-10-06', kind: 'rain', precipProb: 90, precipMm: 6 }),
      makeDay({ date: '2026-10-07', kind: 'clear' }),
      makeDay({ date: '2026-10-08', kind: 'snow', tempMin: -2, precipProb: 80 }),
    ];
    expect(pickBestRidingDay(days)).toBe(1);
  });
});

describe('date helpers', () => {
  it('keys dates in local time', () => {
    expect(localDateKey(new Date(2026, 9, 6, 23, 30))).toBe('2026-10-06');
  });

  it('labels today and tomorrow naturally', () => {
    const now = new Date(2026, 9, 6, 12, 0);
    expect(dayLabel('2026-10-06', now)).toBe('Today');
    expect(dayLabel('2026-10-07', now)).toBe('Tomorrow');
    expect(dayLabel('2026-10-08', now)).toBe('Thu');
  });

  it('names a nearby area from coordinates', () => {
    expect(nearestAreaName(53.48, -2.24)).toBe('Manchester');
    expect(nearestAreaName(0, 0)).toBeNull();
  });
});

describe('open-meteo parsing', () => {
  it('builds a key-less, CORS-friendly URL with 7 days', () => {
    const url = buildOpenMeteoUrl(53.48, -2.24);
    expect(url).toContain('api.open-meteo.com');
    expect(url).toContain('forecast_days=7');
    expect(url).toContain('latitude=53.48');
    expect(url).not.toContain('apikey');
  });

  it('parses the forecast into daily + current readings', () => {
    const report = parseOpenMeteo(openMeteoFixture(), DEFAULT_WEATHER_LOCATION, 1000);
    expect(report.days).toHaveLength(7);
    expect(report.synthetic).toBe(false);
    expect(report.current.tempC).toBe(13);
    expect(report.current.isDay).toBe(true);
    expect(report.days[0]).toMatchObject({ date: '2026-10-06', kind: 'overcast', tempMax: 16, tempMin: 9 });
    expect(report.days[1].kind).toBe('rain');
    expect(report.days[5].kind).toBe('thunder');
    expect(report.days[6].kind).toBe('fog');
    expect(report.fetchedAt).toBe(1000);
  });

  it('survives a partial payload without throwing', () => {
    const report = parseOpenMeteo({ daily: { time: ['2026-10-06'] } }, DEFAULT_WEATHER_LOCATION);
    expect(report.days).toHaveLength(1);
    expect(report.days[0].tempMax).toBe(0);
  });
});

describe('fetchWeatherReport', () => {
  it('returns a parsed report on success', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => openMeteoFixture() })) as any;
    const report = await fetchWeatherReport(DEFAULT_WEATHER_LOCATION, { fetchImpl });
    expect(report.days).toHaveLength(7);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('throws on a non-ok response', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as any;
    await expect(fetchWeatherReport(DEFAULT_WEATHER_LOCATION, { fetchImpl })).rejects.toThrow(/503/);
  });
});

describe('synthetic fallback', () => {
  it('produces a deterministic 7-day report marked synthetic', () => {
    const now = new Date(2026, 9, 6, 12, 0);
    const a = syntheticWeatherReport(DEFAULT_WEATHER_LOCATION, now);
    const b = syntheticWeatherReport(DEFAULT_WEATHER_LOCATION, now);
    expect(a.days).toHaveLength(7);
    expect(a.synthetic).toBe(true);
    expect(a.days[0].date).toBe('2026-10-06');
    expect(a.days).toEqual(b.days);
  });
});

describe('weather cache', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a report', () => {
    const report = syntheticWeatherReport();
    saveCachedWeather(report);
    expect(loadCachedWeather()?.days).toHaveLength(7);
    expect(localStorage.getItem(WEATHER_CACHE_KEY)).toBeTruthy();
  });

  it('expires stale entries', () => {
    const report = syntheticWeatherReport();
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ report, cachedAt: Date.now() - 60 * 60 * 1000 }));
    expect(loadCachedWeather()).toBeNull();
  });

  it('ignores corrupt entries', () => {
    localStorage.setItem(WEATHER_CACHE_KEY, '{not json');
    expect(loadCachedWeather()).toBeNull();
  });
});

describe('location resolution', () => {
  it('uses the device location and names the area', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (ok: any) => ok({ coords: { latitude: 53.4808, longitude: -2.2426 } }),
      },
    });
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ city: 'Manchester' }) })) as any;
    const loc = await resolveWeatherLocation({ fetchImpl });
    expect(loc.source).toBe('device');
    expect(loc.label).toBe('Manchester');
    vi.unstubAllGlobals();
  });

  it('falls back to the workshop when geolocation is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const loc = await resolveWeatherLocation({});
    expect(loc).toEqual(DEFAULT_WEATHER_LOCATION);
    vi.unstubAllGlobals();
  });

  it('falls back to a nearest known area when reverse geocoding fails', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (ok: any) => ok({ coords: { latitude: 53.4808, longitude: -2.2426 } }),
      },
    });
    const fetchImpl = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as any;
    const loc = await resolveWeatherLocation({ fetchImpl });
    expect(loc.label).toBe('Manchester');
    vi.unstubAllGlobals();
  });

  it('reverseGeocodeArea returns null on failure', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    }) as any;
    expect(await reverseGeocodeArea(1, 2, fetchImpl)).toBeNull();
  });
});
