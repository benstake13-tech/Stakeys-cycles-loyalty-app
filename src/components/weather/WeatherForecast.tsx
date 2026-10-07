import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CloudRain,
  Compass,
  Droplets,
  Gauge,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Sunrise,
  Sunset,
  Thermometer,
  Wind,
} from 'lucide-react';
import { WeatherScene } from './WeatherScene';
import {
  DailyWeather,
  KnownPlace,
  RIDING_GRADE_LABEL,
  RidingGrade,
  WeatherLocation,
  WeatherReport,
  dayLabel,
  fetchWeatherReport,
  loadCachedWeather,
  loadManualLocation,
  placeLabel,
  pickBestRidingDay,
  resolveWeatherLocation,
  ridingConditionsFor,
  saveCachedWeather,
  saveManualLocation,
  searchPlaces,
  syntheticWeatherReport,
} from '../../utils/weatherService';

interface WeatherForecastProps {
  isDark?: boolean;
  className?: string;
  /** Skip the geolocation prompt and forecast the workshop area. */
  allowDevice?: boolean;
  /** Show the location / refresh / unit controls. */
  showControls?: boolean;
}

type TempUnit = 'c' | 'f';

const GRADE_STYLE: Record<RidingGrade, { chip: string; ring: string; bar: string }> = {
  excellent: {
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
    ring: 'ring-emerald-500/40',
    bar: 'bg-emerald-400',
  },
  good: {
    chip: 'bg-lime-500/15 text-lime-300 border-lime-500/40',
    ring: 'ring-lime-500/40',
    bar: 'bg-lime-400',
  },
  fair: {
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
    ring: 'ring-amber-500/40',
    bar: 'bg-amber-400',
  },
  poor: {
    chip: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
    ring: 'ring-orange-500/40',
    bar: 'bg-orange-400',
  },
  hazardous: {
    chip: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    ring: 'ring-rose-500/40',
    bar: 'bg-rose-400',
  },
};

function toDisplayTemp(celsius: number, unit: TempUnit): number {
  return unit === 'c' ? celsius : Math.round((celsius * 9) / 5 + 32);
}

function tempSuffix(unit: TempUnit): string {
  return unit === 'c' ? '°C' : '°F';
}

function updatedLabel(ts: number): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
  } catch {
    return '';
  }
}

export const WeatherForecast: React.FC<WeatherForecastProps> = ({
  isDark = true,
  className = '',
  allowDevice = true,
  showControls = true,
}) => {
  const [report, setReport] = useState<WeatherReport | null>(() => loadCachedWeather());
  const [loading, setLoading] = useState(!report);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [unit, setUnit] = useState<TempUnit>('c');
  const [locating, setLocating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<KnownPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<number | null>(null);
  const mounted = useRef(true);

  const applyLocation = useCallback(async (location: WeatherLocation) => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await fetchWeatherReport(location);
      if (!mounted.current) return;
      setReport(fresh);
      saveCachedWeather(fresh);
    } catch {
      if (!mounted.current) return;
      setError('Live weather is unavailable right now — showing the last known forecast.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  const runSearch = useCallback((query: string) => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    if (query.trim().length < 2) {
      setPlaceResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = window.setTimeout(async () => {
      const results = await searchPlaces(query);
      if (!mounted.current) return;
      setPlaceResults(results);
      setSearching(false);
    }, 300);
  }, []);

  const choosePlace = async (place: KnownPlace) => {
    const location: WeatherLocation = {
      latitude: place.latitude,
      longitude: place.longitude,
      label: placeLabel(place),
      source: 'manual',
    };
    saveManualLocation(location);
    setPickerOpen(false);
    setPlaceResults([]);
    setPlaceQuery('');
    await applyLocation(location);
  };

  const load = useCallback(
    async (opts: { useDevice: boolean; force?: boolean; forceDevice?: boolean } = { useDevice: allowDevice }) => {
      if (!opts.force) {
        const cached = loadCachedWeather();
        const manual = loadManualLocation();
        const cacheMatches =
          cached &&
          (!manual ||
            (Math.abs(cached.location.latitude - manual.latitude) < 1e-4 &&
              Math.abs(cached.location.longitude - manual.longitude) < 1e-4));
        if (cached && cacheMatches) {
          if (mounted.current) {
            setReport(cached);
            setLoading(false);
          }
          return;
        }
      }
      setLoading(true);
      setError(null);
      try {
        const location = await resolveWeatherLocation({
          allowDevice: opts.useDevice,
          forceDevice: opts.forceDevice,
        });
        const fresh = await fetchWeatherReport(location);
        if (!mounted.current) return;
        setReport(fresh);
        saveCachedWeather(fresh);
      } catch {
        if (!mounted.current) return;
        setError('Live weather is unavailable right now — showing a sample forecast.');
        setReport((prev) => prev ?? syntheticWeatherReport());
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [allowDevice]
  );

  useEffect(() => {
    mounted.current = true;
    void load({ useDevice: allowDevice });
    const id = window.setInterval(() => void load({ useDevice: allowDevice, force: true }), 30 * 60 * 1000);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
  }, [load, allowDevice]);

  const useMyLocation = async () => {
    setLocating(true);
    try {
      await load({ useDevice: true, force: true, forceDevice: true });
    } finally {
      if (mounted.current) setLocating(false);
    }
  };

  const days = report?.days ?? [];
  const bestIndex = useMemo(() => (days.length ? pickBestRidingDay(days) : 0), [days]);
  const active: DailyWeather | undefined = days[selected] ?? days[0];
  const conditions = active ? ridingConditionsFor(active) : null;
  const gradeStyle = conditions ? GRADE_STYLE[conditions.grade] : GRADE_STYLE.fair;
  const unitLabel = tempSuffix(unit);

  const shell = isDark
    ? 'bg-neutral-900/70 border-neutral-800'
    : 'bg-white/80 border-neutral-200';
  const muted = isDark ? 'text-neutral-400' : 'text-neutral-500';
  const strong = isDark ? 'text-white' : 'text-neutral-900';

  const stat = (Icon: any, label: string, value: string) => (
    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${shell}`}>
      <Icon className={`w-3.5 h-3.5 ${muted}`} />
      <div className="leading-tight">
        <div className={`text-[10px] uppercase tracking-wider ${muted}`}>{label}</div>
        <div className={`text-xs font-bold ${strong}`}>{value}</div>
      </div>
    </div>
  );

  return (
    <div className={`space-y-4 ${className}`} data-testid="weather-forecast">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-400 text-neutral-950 shadow">
            <CloudRain className="w-4 h-4" />
          </span>
          <div>
            <div className={`text-sm font-black ${strong} flex items-center gap-1.5`}>
              Riding Weather
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                title="Search for a place to forecast"
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider cursor-pointer hover:border-sky-500/50 ${shell} ${muted}`}
              >
                <MapPin className="w-2.5 h-2.5" />
                {report?.location.label ?? 'Locating…'}
                {report?.location.source === 'device' ? ' (GPS)' : ''}
              </button>
            </div>
            <p className={`text-[11px] ${muted}`}>
              Next 7 days · {report ? `updated ${updatedLabel(report.fetchedAt)}` : 'loading…'}
              {report?.synthetic ? ' · sample data' : ' · live'}
            </p>
          </div>
        </div>

        {showControls && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={useMyLocation}
              disabled={locating}
              className={`pressable inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold cursor-pointer disabled:opacity-60 ${shell} ${strong}`}
            >
              {locating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5" />}
              Use my location
            </button>
            <button
              type="button"
              onClick={() => void load({ useDevice: allowDevice, force: true })}
              className={`pressable inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold cursor-pointer ${shell} ${strong}`}
              aria-label="Refresh forecast"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className={`inline-flex overflow-hidden rounded-xl border ${shell}`}>
              {(['c', 'f'] as TempUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`px-2.5 py-2 text-[11px] font-bold cursor-pointer ${
                    unit === u ? 'bg-emerald-500 text-neutral-950' : muted
                  }`}
                >
                  °{u.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {pickerOpen && (
        <div className={`rounded-2xl border p-3 ${shell}`} data-testid="weather-location-picker">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${muted}`} />
            <input
              type="text"
              autoFocus
              value={placeQuery}
              onChange={(e) => {
                setPlaceQuery(e.target.value);
                runSearch(e.target.value);
              }}
              placeholder="Search town or city (e.g. Stockport)"
              className={`w-full rounded-xl border pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-sky-500 ${shell} ${strong}`}
            />
          </div>
          <div className="mt-2 max-h-56 overflow-y-auto">
            {searching && <p className={`px-1 py-2 text-[11px] ${muted}`}>Searching…</p>}
            {!searching && placeResults.length === 0 && placeQuery.trim().length >= 2 && (
              <p className={`px-1 py-2 text-[11px] ${muted}`}>No matching places.</p>
            )}
            {placeResults.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => void choosePlace(place)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold cursor-pointer hover:bg-sky-500/10 ${strong}`}
              >
                <span className="flex items-center gap-1.5">
                  <MapPin className={`w-3 h-3 ${muted}`} />
                  {place.name}
                  {place.region ? <span className={muted}>· {place.region}</span> : null}
                </span>
                {place.country && <span className={`text-[10px] uppercase ${muted}`}>{place.country}</span>}
              </button>
            ))}
          </div>
          <p className={`mt-1 px-1 text-[10px] ${muted}`}>
            Pick your town for an accurate forecast even without GPS permission. Saved to this device.
          </p>
        </div>
      )}

      {active && conditions && (
        <div className={`relative overflow-hidden rounded-2xl border ${shell}`}>
          <div className="relative h-44 sm:h-52">
            <WeatherScene
              kind={active.kind}
              isDay={selected === 0 ? report?.current.isDay ?? true : true}
              className="absolute inset-0 h-full w-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">
                  {dayLabel(active.date)}
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-black text-white leading-none">
                    {toDisplayTemp(active.tempMax, unit)}
                    <span className="text-lg align-top">{unitLabel}</span>
                  </span>
                  <span className="pb-1 text-sm font-semibold text-white/70">
                    {toDisplayTemp(active.tempMin, unit)}
                    {unitLabel}
                  </span>
                </div>
                <div className="mt-1 text-xs font-bold text-white/90">{active.label}</div>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${gradeStyle.chip}`}>
                  <Sparkles className="w-3 h-3" /> {RIDING_GRADE_LABEL[conditions.grade]} · {conditions.score}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <p className={`text-sm font-semibold ${strong}`}>{conditions.headline}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stat(Droplets, 'Rain chance', `${active.precipProb}%`)}
              {stat(Wind, 'Wind', `${active.windMaxKph} km/h`)}
              {stat(Navigation, 'Gusts', `${active.windGustKph} km/h`)}
              {stat(Thermometer, 'Feels like', `${toDisplayTemp(report?.current.feelsLikeC ?? active.tempMax, unit)}${unitLabel}`)}
              {stat(Droplets, 'Humidity', `${report?.current.humidity ?? 0}%`)}
              {stat(Gauge, 'Pressure', `${report?.current.pressureHpa ?? 0} hPa`)}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {active.sunrise && (
                <span className={`inline-flex items-center gap-1 ${muted}`}>
                  <Sunrise className="w-3.5 h-3.5" /> {active.sunrise.slice(11)}
                </span>
              )}
              {active.sunset && (
                <span className={`inline-flex items-center gap-1 ${muted}`}>
                  <Sunset className="w-3.5 h-3.5" /> {active.sunset.slice(11)}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 ${muted}`}>
                <Compass className="w-3.5 h-3.5" /> {active.windMaxKph > 25 ? 'Blustery' : 'Calm-ish'}
              </span>
            </div>
            {conditions.advisories.length > 0 && (
              <ul className={`space-y-1 text-[11px] ${muted}`}>
                {conditions.advisories.map((a) => (
                  <li key={a} className="flex items-start gap-1.5">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-current" />
                    {a}
                  </li>
                ))}
              </ul>
            )}
            {error && <p className="text-[11px] text-amber-400">{error}</p>}
          </div>
        </div>
      )}

      <div className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
        {days.map((day, i) => {
          const c = ridingConditionsFor(day);
          const style = GRADE_STYLE[c.grade];
          const isActive = i === selected;
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => setSelected(i)}
              className={`pressable relative w-[104px] shrink-0 overflow-hidden rounded-2xl border text-left cursor-pointer ring-2 ${
                isActive ? `${style.ring} border-transparent` : 'border-transparent ring-transparent'
              } ${shell}`}
              aria-pressed={isActive}
            >
              <div className="relative h-20">
                <WeatherScene kind={day.kind} isDay className="absolute inset-0 h-full w-full" animate={isActive} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute left-2 top-1.5 text-[10px] font-black uppercase tracking-wider text-white/90">
                  {dayLabel(day.date)}
                </div>
                {i === bestIndex && (
                  <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-neutral-950" title="Best riding day">
                    <Star className="w-3 h-3" />
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-2 pb-1">
                  <span className="text-sm font-black text-white">
                    {toDisplayTemp(day.tempMax, unit)}°
                  </span>
                  <span className="text-[10px] font-semibold text-white/70">
                    {toDisplayTemp(day.tempMin, unit)}°
                  </span>
                </div>
              </div>
              <div className="space-y-1.5 p-2">
                <div className={`text-[10px] font-bold ${strong} truncate`}>{day.label}</div>
                <div className={`flex items-center justify-between text-[10px] ${muted}`}>
                  <span className="inline-flex items-center gap-0.5">
                    <Droplets className="w-3 h-3" />
                    {day.precipProb}%
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <Wind className="w-3 h-3" />
                    {day.windMaxKph}
                  </span>
                </div>
                <div className={`inline-flex w-full items-center justify-center rounded-lg border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${style.chip}`}>
                  {RIDING_GRADE_LABEL[c.grade]}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
