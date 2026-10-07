import React, { useEffect, useState } from 'react';
import { CloudRain, Droplets, Wind } from 'lucide-react';
import {
  DEFAULT_WEATHER_LOCATION,
  DailyWeather,
  WeatherReport,
  fetchWeatherReport,
  ridingConditionsFor,
  weatherEmoji,
} from '../../utils/weatherService';

interface BookingRidingWeatherProps {
  /** The drop-off date the rider is choosing (YYYY-MM-DD). */
  date?: string;
  isDark?: boolean;
  className?: string;
}

/**
 * A compact "what's the weather like on your drop-off day?" strip for the
 * booking flow. Reuses the shared Open-Meteo service (no extra API key) and
 * forecasts the workshop area rather than asking for device location mid-form.
 */
export const BookingRidingWeather: React.FC<BookingRidingWeatherProps> = ({
  date,
  isDark = true,
  className = '',
}) => {
  const [report, setReport] = useState<WeatherReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchWeatherReport(DEFAULT_WEATHER_LOCATION)
      .then((r) => {
        if (alive) setReport(r);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const day: DailyWeather | undefined = date ? report?.days.find((d) => d.date === date) : report?.days[0];

  const shell = isDark ? 'bg-[#0b0f14] border-neutral-800' : 'bg-sky-50 border-sky-200';
  const strong = isDark ? 'text-white' : 'text-neutral-900';
  const muted = isDark ? 'text-neutral-400' : 'text-neutral-600';

  if (failed || !day) {
    return (
      <div className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-[11px] ${shell} ${muted} ${className}`}>
        <CloudRain className="w-3.5 h-3.5 shrink-0" />
        {failed ? 'Riding forecast unavailable right now.' : 'Checking the forecast for your drop-off day…'}
      </div>
    );
  }

  const conditions = ridingConditionsFor(day);

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border px-3.5 py-2.5 text-[11px] ${shell} ${className}`}>
      <span className={`flex items-center gap-1.5 font-bold ${strong}`}>
        <span className="text-base leading-none">{weatherEmoji(day.kind)}</span>
        {day.label}
      </span>
      <span className={`font-semibold ${muted}`}>
        {Math.round(day.tempMin)}–{Math.round(day.tempMax)}°C
      </span>
      <span className={`flex items-center gap-1 ${muted}`}>
        <Droplets className="w-3 h-3" /> {day.precipProb}%
      </span>
      <span className={`flex items-center gap-1 ${muted}`}>
        <Wind className="w-3 h-3" /> {day.windMaxKph} km/h
      </span>
      <span className={`w-full font-semibold ${strong}`}>{conditions.headline}</span>
    </div>
  );
};
