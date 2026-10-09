import React from 'react';
import { Droplets, Eye, Gauge, Navigation, Sun, Thermometer, Wind } from 'lucide-react';
import {
  AirQuality,
  CurrentWeather,
  DailyWeather,
  HourlyWeather,
  MoonPhase,
  aqiBand,
  compassPoint,
  uvBand,
} from '../../utils/weatherService';

interface Shell {
  shell: string;
  muted: string;
  strong: string;
}

type TempFn = (celsius: number) => number;

/** Next-24h hourly strip: icon, temp, precipitation chance. */
export const HourlyStrip: React.FC<
  Shell & { hourly: HourlyWeather[]; temp: TempFn; unitLabel: string }
> = ({ hourly, temp, unitLabel, shell, muted, strong }) => {
  if (!hourly.length) return null;
  return (
    <div className={`rounded-2xl border p-3 ${shell}`} data-testid="weather-hourly">
      <div className={`mb-2 text-[10px] font-black uppercase tracking-wider ${muted}`}>Next 24 hours</div>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {hourly.map((h) => {
          const hour = h.time.slice(11, 16);
          return (
            <div key={h.time} className="w-14 shrink-0 text-center">
              <div className={`text-[10px] font-bold ${muted}`}>{hour}</div>
              <div className={`mt-1 text-sm font-black ${strong}`}>{temp(h.tempC)}°</div>
              <div className={`mt-0.5 inline-flex items-center gap-0.5 text-[9px] ${muted}`}>
                <Droplets className="w-2.5 h-2.5" />
                {h.precipProb}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AQ_TONE: Record<string, string> = {
  good: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  fair: 'bg-lime-500/15 text-lime-300 border-lime-500/40',
  moderate: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  poor: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
  very_poor: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
};

/** Air-quality card (AQI + band + key pollutants), or a graceful empty state. */
export const AirQualityCard: React.FC<Shell & { air: AirQuality | null }> = ({
  air,
  shell,
  muted,
  strong,
}) => {
  const band = aqiBand(air?.europeanAqi ?? null);
  return (
    <div className={`rounded-2xl border p-3 ${shell}`} data-testid="weather-air-quality">
      <div className={`text-[10px] font-black uppercase tracking-wider ${muted}`}>Air quality</div>
      {air && air.europeanAqi != null ? (
        <>
          <div className="mt-1 flex items-center gap-2">
            <span className={`text-2xl font-black ${strong}`}>{Math.round(air.europeanAqi)}</span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${AQ_TONE[band.tone]}`}>
              {band.label}
            </span>
          </div>
          <div className={`mt-1 text-[10px] ${muted}`}>European AQI</div>
          <div className={`mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] ${muted}`}>
            {air.pm25 != null && <span>PM2.5 · {round1(air.pm25)}</span>}
            {air.pm10 != null && <span>PM10 · {round1(air.pm10)}</span>}
            {air.no2 != null && <span>NO₂ · {round1(air.no2)}</span>}
            {air.ozone != null && <span>O₃ · {round1(air.ozone)}</span>}
          </div>
        </>
      ) : (
        <div className={`mt-1 text-[11px] ${muted}`}>Air quality unavailable right now.</div>
      )}
    </div>
  );
};

/** Moon card: phase name, emoji and illuminated fraction. */
export const MoonPhaseCard: React.FC<Shell & { moon: MoonPhase }> = ({ moon, shell, muted, strong }) => (
  <div className={`rounded-2xl border p-3 ${shell}`} data-testid="weather-moon">
    <div className={`text-[10px] font-black uppercase tracking-wider ${muted}`}>Moon</div>
    <div className="mt-1 flex items-center gap-2">
      <span className="text-3xl leading-none" aria-hidden>
        {moon.emoji}
      </span>
      <div>
        <div className={`text-sm font-black ${strong}`}>{moon.name}</div>
        <div className={`text-[10px] ${muted}`}>{Math.round(moon.illumination * 100)}% illuminated</div>
      </div>
    </div>
  </div>
);

/** Sun card: sunrise / sunset / daylight length. */
export const SunCard: React.FC<Shell & { day: DailyWeather }> = ({ day, shell, muted, strong }) => (
  <div className={`rounded-2xl border p-3 ${shell}`} data-testid="weather-sun">
    <div className={`text-[10px] font-black uppercase tracking-wider ${muted}`}>Sun</div>
    <div className="mt-1 flex items-center gap-3">
      <div>
        <div className={`text-[10px] uppercase ${muted}`}>Rise</div>
        <div className={`text-xs font-bold ${strong}`}>{day.sunrise ? day.sunrise.slice(11, 16) : '—'}</div>
      </div>
      <div>
        <div className={`text-[10px] uppercase ${muted}`}>Set</div>
        <div className={`text-xs font-bold ${strong}`}>{day.sunset ? day.sunset.slice(11, 16) : '—'}</div>
      </div>
      <div>
        <div className={`text-[10px] uppercase ${muted}`}>Daylight</div>
        <div className={`text-xs font-bold ${strong}`}>{formatDuration(day.daylightSeconds)}</div>
      </div>
    </div>
  </div>
);

/** Full details grid: live current readings blended with the selected day's totals. */
export const DetailsGrid: React.FC<
  Shell & { day: DailyWeather; current: CurrentWeather | null; temp: TempFn; unitLabel: string }
> = ({ day, current, temp, unitLabel, shell, muted, strong }) => {
  const rows: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <Thermometer className="w-3.5 h-3.5" />, label: 'Feels like', value: `${temp(day.feelsLikeMax)}${unitLabel} / ${temp(day.feelsLikeMin)}${unitLabel}` },
    { icon: <Droplets className="w-3.5 h-3.5" />, label: 'Humidity', value: current ? `${current.humidity}%` : '—' },
    { icon: <Gauge className="w-3.5 h-3.5" />, label: 'Pressure', value: current ? `${current.pressureHpa} hPa` : '—' },
    { icon: <Droplets className="w-3.5 h-3.5" />, label: 'Dew point', value: current ? `${temp(current.dewPointC)}${unitLabel}` : '—' },
    { icon: <Eye className="w-3.5 h-3.5" />, label: 'Visibility', value: current ? formatVisibility(current.visibilityM) : '—' },
    { icon: <Wind className="w-3.5 h-3.5" />, label: 'Wind', value: `${day.windMaxKph} km/h ${compassPoint(day.windDir)}` },
    { icon: <Navigation className="w-3.5 h-3.5" />, label: 'Gusts', value: `${day.windGustKph} km/h` },
    { icon: <Sun className="w-3.5 h-3.5" />, label: 'UV index', value: `${day.uvMax} · ${uvBand(day.uvMax)}` },
    { icon: <Droplets className="w-3.5 h-3.5" />, label: 'Rain', value: `${day.precipProb}% · ${day.precipMm} mm` },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="weather-details-grid">
      {rows.map((r) => (
        <div key={r.label} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${shell}`}>
          <span className={muted}>{r.icon}</span>
          <div className="leading-tight">
            <div className={`text-[10px] uppercase tracking-wider ${muted}`}>{r.label}</div>
            <div className={`text-xs font-bold ${strong}`}>{r.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatVisibility(metres: number): string {
  if (!Number.isFinite(metres) || metres <= 0) return '—';
  return metres >= 1000 ? `${round1(metres / 1000)} km` : `${Math.round(metres)} m`;
}
