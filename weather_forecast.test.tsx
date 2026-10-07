import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// jsdom has no canvas backend, so provide a no-op 2D context for the animated sky.
function stubCanvas() {
  const ctx: any = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    save: vi.fn(),
    restore: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    shadowBlur: 0,
    shadowColor: '',
  };
  (HTMLCanvasElement.prototype as any).getContext = () => ctx;
  return ctx;
}

vi.mock('../../src/context/ShopContext', () => ({
  useShop: () => ({ theme: 'dark' }),
}));

import { WeatherScene, skyPaletteFor } from './src/components/weather/WeatherScene';
import { WeatherForecast } from './src/components/weather/WeatherForecast';

const DAY_MS = 24 * 60 * 60 * 1000;

function fixture() {
  const start = new Date();
  const time = Array.from({ length: 7 }, (_, i) =>
    new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10)
  );
  return {
    timezone: 'Europe/London',
    current: {
      temperature_2m: 13,
      apparent_temperature: 11,
      is_day: 1,
      precipitation: 0,
      weather_code: 3,
      wind_speed_10m: 14,
    },
    daily: {
      time,
      weather_code: [0, 61, 3, 80, 2, 95, 45],
      temperature_2m_max: [16, 14, 18, 15, 17, 13, 12],
      temperature_2m_min: [9, 8, 11, 7, 10, 6, 5],
      precipitation_sum: [0, 5, 0, 2, 0, 8, 0],
      precipitation_probability_max: [0, 85, 10, 60, 20, 95, 15],
      wind_speed_10m_max: [18, 34, 12, 27, 20, 46, 15],
      wind_gusts_10m_max: [30, 55, 20, 44, 33, 72, 26],
      uv_index_max: [2, 1, 3, 1, 2, 0, 1],
      sunrise: time.map((d) => `${d}T07:10`),
      sunset: time.map((d) => `${d}T18:35`),
    },
  };
}

beforeEach(() => {
  stubCanvas();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('WeatherScene', () => {
  it('renders a canvas and paints without throwing', () => {
    const { container } = render(<WeatherScene kind="rain" isDay animate={false} />);
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('maps conditions to distinct sky palettes', () => {
    expect(skyPaletteFor('clear', true).top).not.toBe(skyPaletteFor('thunder', true).top);
    expect(skyPaletteFor('clear', false).top).not.toBe(skyPaletteFor('clear', true).top);
    expect(skyPaletteFor('snow', true).precip).toMatch(/255,255,255/);
  });
});

describe('WeatherForecast', () => {
  it('renders a live 7-day forecast with riding grades', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('open-meteo')) return { ok: true, json: async () => fixture() };
        return { ok: false, json: async () => ({}) };
      })
    );

    render(<WeatherForecast isDark />);

    await waitFor(() => expect(screen.getByText('Riding Weather')).toBeTruthy());
    // Today's hero shows the real temperature and a grade chip.
    await waitFor(() => expect(screen.getAllByText('Today').length).toBeGreaterThan(0));
    expect(screen.getByText('Tomorrow')).toBeTruthy();
    expect(screen.getAllByText('Clear').length).toBeGreaterThan(0);
    expect(screen.getByText(/Excellent ·/)).toBeTruthy();
    // Seven day cards.
    expect(screen.getAllByText(/^(Today|Tomorrow|[A-Z][a-z]{2})$/).length).toBeGreaterThanOrEqual(7);
  });

  it('selects a different day when its card is clicked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => fixture() }))
    );
    render(<WeatherForecast isDark />);
    await waitFor(() => expect(screen.getByText('Tomorrow')).toBeTruthy());

    fireEvent.click(screen.getByText('Tomorrow'));
    // The hero now describes the rainy day with an advisory.
    await waitFor(() => expect(screen.getAllByText(/Showers|Rain/).length).toBeGreaterThan(0));
  });

  it('switches temperature units', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => fixture() }))
    );
    render(<WeatherForecast isDark />);
    await waitFor(() => expect(screen.getByText('°F')).toBeTruthy());

    fireEvent.click(screen.getByText('°F'));
    // 16°C -> 61°F somewhere in the hero.
    await waitFor(() => expect(screen.getAllByText(/61/).length).toBeGreaterThan(0));
  });

  it('falls back to a sample forecast when the network fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      })
    );
    render(<WeatherForecast isDark />);
    await waitFor(() => expect(screen.getByText(/sample data/)).toBeTruthy());
    expect(screen.getByText(/sample forecast/)).toBeTruthy();
  });

  it('uses the cached forecast without a network round-trip', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => fixture() }));
    vi.stubGlobal('fetch', fetchSpy);
    const first = render(<WeatherForecast isDark />);
    await waitFor(() => expect(screen.getAllByText('Today').length).toBeGreaterThan(0));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    first.unmount();
    const callsAfterFirst = fetchSpy.mock.calls.length;

    render(<WeatherForecast isDark />);
    await waitFor(() => expect(screen.getAllByText('Today').length).toBeGreaterThan(0));
    // No additional weather request was needed — the cache served it.
    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
  });
});
