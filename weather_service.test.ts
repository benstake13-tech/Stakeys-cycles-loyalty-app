import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_WEATHER_LOCATION,
  WeatherLocation,
  buildGeocodeUrl,
  buildOpenMeteoUrl,
  clearManualLocation,
  dayLabel,
  fetchWeatherReport,
  loadCachedWeather,
  loadManualLocation,
  localDateKey,
  nearestAreaName,
  parseOpenMeteo,
  pickBestRidingDay,
  placeLabel,
  resolveWeatherLocation,
  reverseGeocodeArea,
  ridingConditionsFor,
  saveCachedWeather,
  saveManualLocation,
  searchPlaces,
  syntheticWeatherReport,
  weatherKindFor,
  weatherLabel,
  WEATHER_CACHE_KEY,
  DailyWeather,
  buildAirQualityUrl,
  fetchAirQuality,
  parseAirQuality,
  moonPhase,
  compassPoint,
  aqiBand,
  uvBand,
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
    feelsLikeMax: 17,
    feelsLikeMin: 9,
    precipProb: 0,
    precipMm: 0,
    windMaxKph: 8,
    windGustKph: 15,
    windDir: 180,
    uvMax: 3,
    daylightSeconds: 41400,
    sunshineSeconds: 20000,
    sunrise: '2026-10-06T07:12',
    sunset: '2026-10-06T18:40',
    moon: { phase: 0.5, name: 'Full Moon', illumination: 1, emoji: '🌕' },
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
      wind_direction_10m: 210,
      wind_gusts_10m: 28,
      relative_humidity_2m: 82,
      pressure_msl: 1009.4,
      dew_point_2m: 10.2,
      visibility: 14000,
    },
    hourly: {
      time: Array.from({ length: 30 }, (_, i) => {
        const d = new Date(Date.UTC(2026, 9, 6, 0, 0) + i * 3600_000);
        return d.toISOString().slice(0, 13) + ':00';
      }),
      temperature_2m: Array.from({ length: 30 }, (_, i) => 10 + (i % 8)),
      apparent_temperature: Array.from({ length: 30 }, (_, i) => 9 + (i % 8)),
      relative_humidity_2m: Array.from({ length: 30 }, () => 80),
      precipitation_probability: Array.from({ length: 30 }, (_, i) => (i % 4) * 20),
      precipitation: Array.from({ length: 30 }, () => 0.1),
      weather_code: Array.from({ length: 30 }, () => 3),
      wind_speed_10m: Array.from({ length: 30 }, () => 15),
      wind_direction_10m: Array.from({ length: 30 }, () => 200),
      wind_gusts_10m: Array.from({ length: 30 }, () => 26),
      visibility: Array.from({ length: 30 }, () => 13000),
      dew_point_2m: Array.from({ length: 30 }, () => 9),
      uv_index: Array.from({ length: 30 }, (_, i) => (i % 12 < 6 ? 2 : 0)),
      is_day: Array.from({ length: 30 }, (_, i) => (i % 24 >= 7 && i % 24 <= 19 ? 1 : 0)),
    },
    daily: {
      time,
      weather_code: [3, 61, 0, 80, 2, 95, 45],
      temperature_2m_max: [16.1, 14.2, 18.9, 15.5, 17.0, 13.3, 12.8],
      temperature_2m_min: [9.4, 8.1, 11.2, 7.6, 10.1, 6.9, 5.4],
      apparent_temperature_max: [15.1, 13.2, 17.9, 14.5, 16.0, 12.3, 11.8],
      apparent_temperature_min: [8.4, 7.1, 10.2, 6.6, 9.1, 5.9, 4.4],
      precipitation_sum: [0.4, 5.2, 0, 2.1, 0.1, 8.8, 0],
      precipitation_probability_max: [30, 85, 5, 60, 20, 95, 15],
      wind_speed_10m_max: [18, 34, 12, 27, 20, 46, 15],
      wind_gusts_10m_max: [30, 55, 20, 44, 33, 72, 26],
      wind_direction_10m_dominant: [180, 210, 90, 240, 200, 260, 300],
      uv_index_max: [2.4, 1.1, 3.6, 1.8, 2.9, 0.7, 1.2],
      daylight_duration: time.map(() => 41400),
      sunshine_duration: time.map(() => 18000),
      sunrise: time.map((d) => `${d}T07:10`),
      sunset: time.map((d) => `${d}T18:35`),
    },
  };
}

/** A realistic Open-Meteo air-quality response. */
function airQualityFixture() {
  return {
    current: {
      european_aqi: 32,
      us_aqi: 41,
      pm10: 12.4,
      pm2_5: 8.1,
      carbon_monoxide: 210,
      nitrogen_dioxide: 18.2,
      sulphur_dioxide: 3.4,
      ozone: 54.1,
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
    expect(report.current.humidity).toBe(82);
    expect(report.current.pressureHpa).toBe(1009.4);
    expect(report.current.windDir).toBe(210);
    expect(report.current.dewPointC).toBe(10.2);
    expect(report.current.visibilityM).toBe(14000);
    expect(report.days[0]).toMatchObject({ date: '2026-10-06', kind: 'overcast', tempMax: 16, tempMin: 9 });
    expect(report.days[1].kind).toBe('rain');
    expect(report.days[5].kind).toBe('thunder');
    expect(report.days[6].kind).toBe('fog');
    expect(report.days[0].windDir).toBe(180);
    expect(report.days[0].daylightSeconds).toBe(41400);
    expect(report.days[0].moon.name).toMatch(/Moon|Quarter|Gibbous|Crescent/);
    expect(report.fetchedAt).toBe(1000);
  });

  it('parses hourly readings and keeps the next 24 hours', () => {
    const report = parseOpenMeteo(openMeteoFixture(), DEFAULT_WEATHER_LOCATION, Date.UTC(2026, 9, 6, 6, 30));
    expect(report.hourly.length).toBeGreaterThan(0);
    expect(report.hourly.length).toBeLessThanOrEqual(24);
    expect(report.hourly[0]).toMatchObject({ kind: 'overcast', humidity: 80 });
    expect(report.hourly[0].windDir).toBe(200);
    // Everything returned is at or after the current hour.
    const firstMs = new Date(report.hourly[0].time).getTime();
    expect(firstMs).toBeGreaterThanOrEqual(Date.UTC(2026, 9, 6, 6, 0));
  });

  it('survives a partial payload without throwing', () => {
    const report = parseOpenMeteo({ daily: { time: ['2026-10-06'] } }, DEFAULT_WEATHER_LOCATION);
    expect(report.days).toHaveLength(1);
    expect(report.days[0].tempMax).toBe(0);
  });
});

describe('fetchWeatherReport', () => {
  it('returns a parsed report and attaches air quality on success', async () => {
    const fetchImpl = vi.fn(async (url: any) =>
      String(url).includes('air-quality')
        ? { ok: true, json: async () => airQualityFixture() }
        : { ok: true, json: async () => openMeteoFixture() }
    ) as any;
    const report = await fetchWeatherReport(DEFAULT_WEATHER_LOCATION, { fetchImpl });
    expect(report.days).toHaveLength(7);
    expect(report.airQuality?.europeanAqi).toBe(32);
    // One forecast call + one air-quality call.
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('still returns the forecast when air quality fails', async () => {
    const fetchImpl = vi.fn(async (url: any) => {
      if (String(url).includes('air-quality')) throw new Error('aq down');
      return { ok: true, json: async () => openMeteoFixture() };
    }) as any;
    const report = await fetchWeatherReport(DEFAULT_WEATHER_LOCATION, { fetchImpl });
    expect(report.days).toHaveLength(7);
    expect(report.airQuality).toBeNull();
  });

  it('throws on a non-ok response', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as any;
    await expect(fetchWeatherReport(DEFAULT_WEATHER_LOCATION, { fetchImpl })).rejects.toThrow(/503/);
  });
});

describe('air quality', () => {
  it('builds a key-less air-quality URL', () => {
    const url = buildAirQualityUrl(53.48, -2.24);
    expect(url).toContain('air-quality-api.open-meteo.com');
    expect(url).toContain('european_aqi');
    expect(url).not.toContain('apikey');
  });

  it('parses the AQ payload', () => {
    const aq = parseAirQuality(airQualityFixture(), 5000);
    expect(aq.europeanAqi).toBe(32);
    expect(aq.usAqi).toBe(41);
    expect(aq.pm25).toBe(8.1);
    expect(aq.fetchedAt).toBe(5000);
  });

  it('returns null (never throws) when the AQ request fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    }) as any;
    expect(await fetchAirQuality(DEFAULT_WEATHER_LOCATION, { fetchImpl })).toBeNull();
  });
});

describe('moon phase', () => {
  it('reports a new moon near the reference new moon', () => {
    const m = moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14)));
    expect(m.name).toBe('New Moon');
    expect(m.illumination).toBeLessThan(0.05);
    expect(m.emoji).toBe('🌑');
  });

  it('reports a full moon roughly half a synodic month later', () => {
    const full = new Date(Date.UTC(2000, 0, 6, 18, 14) + 14.765 * 86400000);
    const m = moonPhase(full);
    expect(m.name).toBe('Full Moon');
    expect(m.illumination).toBeGreaterThan(0.95);
    expect(m.emoji).toBe('🌕');
  });

  it('is deterministic and always 0..1', () => {
    const d = new Date(Date.UTC(2026, 9, 8));
    const a = moonPhase(d);
    const b = moonPhase(d);
    expect(a).toEqual(b);
    expect(a.phase).toBeGreaterThanOrEqual(0);
    expect(a.phase).toBeLessThan(1);
  });
});

describe('presentation helpers', () => {
  it('maps bearings to compass points', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(90)).toBe('E');
    expect(compassPoint(180)).toBe('S');
    expect(compassPoint(270)).toBe('W');
    expect(compassPoint(350)).toBe('N');
  });

  it('bands AQI and UV', () => {
    expect(aqiBand(10).label).toBe('Good');
    expect(aqiBand(90).tone).toBe('very_poor');
    expect(aqiBand(null).label).toBe('Unknown');
    expect(uvBand(0)).toBe('None');
    expect(uvBand(3)).toBe('Moderate');
    expect(uvBand(12)).toBe('Extreme');
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

describe('manual location + geocoding', () => {
  beforeEach(() => localStorage.clear());

  it('saves, loads and clears a manual location', () => {
    const loc: WeatherLocation = { latitude: 53.41, longitude: -2.16, label: 'Stockport, England', source: 'manual' };
    saveManualLocation(loc);
    const loaded = loadManualLocation();
    expect(loaded).toMatchObject({ latitude: 53.41, longitude: -2.16, label: 'Stockport, England', source: 'manual' });
    clearManualLocation();
    expect(loadManualLocation()).toBeNull();
  });

  it('prefers a saved manual location over the device', async () => {
    saveManualLocation({ latitude: 51.5, longitude: -0.12, label: 'London', source: 'manual' });
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition: (ok: any) => ok({ coords: { latitude: 53.48, longitude: -2.24 } }) },
    });
    const loc = await resolveWeatherLocation({});
    expect(loc.source).toBe('manual');
    expect(loc.label).toBe('London');
    vi.unstubAllGlobals();
  });

  it('forceDevice overrides the saved manual location', async () => {
    saveManualLocation({ latitude: 51.5, longitude: -0.12, label: 'London', source: 'manual' });
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition: (ok: any) => ok({ coords: { latitude: 53.4808, longitude: -2.2426 } }) },
    });
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ city: 'Manchester' }) })) as any;
    const loc = await resolveWeatherLocation({ forceDevice: true, fetchImpl });
    expect(loc.source).toBe('device');
    expect(loc.label).toBe('Manchester');
    vi.unstubAllGlobals();
  });

  it('builds a key-less geocoding URL', () => {
    const url = buildGeocodeUrl('Stockport');
    expect(url).toContain('geocoding-api.open-meteo.com');
    expect(url).toContain('name=Stockport');
    expect(url).not.toContain('apikey');
  });

  it('maps geocoder results into places and labels them', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [
          { id: 1, name: 'Stockport', admin1: 'England', country_code: 'GB', latitude: 53.41, longitude: -2.16 },
          { id: 2, name: 'Nowhere', latitude: null, longitude: null },
        ],
      }),
    })) as any;
    const places = await searchPlaces('Stockport', fetchImpl);
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ name: 'Stockport', region: 'England', country: 'GB' });
    expect(placeLabel(places[0])).toBe('Stockport, England');
  });

  it('returns [] for short queries and on geocoder failure', async () => {
    expect(await searchPlaces('a', (async () => ({ ok: true, json: async () => ({}) })) as any)).toEqual([]);
    const boom = (async () => {
      throw new Error('offline');
    }) as any;
    expect(await searchPlaces('Manchester', boom)).toEqual([]);
  });
});
