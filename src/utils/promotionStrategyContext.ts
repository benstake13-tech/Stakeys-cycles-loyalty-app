import type { ServiceBooking, SaleTransaction, UserProfile } from '../types/bikeShop';
import type { WebPriceItem, WebProduct } from '../types/websiteContent';
import type { WeatherReport } from './weatherService';
import { affordableSpend, monthEvents, RIDING_STYLES, validMonth, type PromotionStrategy, type RidingStyle, type StrategySegment } from '../../supabase/functions/_shared/promotionStrategy';

export interface StrategyInputs {
  month?: string; maxRepairValuePct?: number; users?: UserProfile[]; priceList?: WebPriceItem[];
  staffNotes?: string; targets?: Record<string, unknown>;
  products?: WebProduct[];
  officialEvents?: { title: string; date: string }[];
}

export function londonMonth(today = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' }).formatToParts(today);
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`;
}

function timestamp(value: any): number {
  const date = value?.toDate instanceof Function ? value.toDate() : value?.seconds != null ? new Date(value.seconds * 1000) : new Date(value);
  return date.getTime();
}
const median = (values: number[]): number | null => {
  const sorted = values.filter(v => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return Math.round((sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) * 100) / 100;
};

export function catalogueServices(priceList: WebPriceItem[]): PromotionStrategy['services'] {
  return priceList.flatMap(p => {
    const exact = /^£\s*\d+(?:\.\d{1,2})?$/.test(p.price.trim()) ? Number(p.price.replace(/£\s*/, '')) : NaN;
    const price = p.unitPrice ?? exact;
    return Number.isFinite(price) && price > 0 ? [{ id: p.id, title: p.item, scope: p.scope, priceGbp: price, terms: [p.note, p.desc].filter(Boolean).join(' ').slice(0, 250) }] : [];
  });
}

export function buildStrategyContext(today: Date, weather: WeatherReport | null | undefined, bookings: ServiceBooking[], sales: SaleTransaction[], input: StrategyInputs = {}): PromotionStrategy {
  const month = input.month && validMonth(input.month) ? input.month : londonMonth(today);
  const percent = Number.isFinite(input.maxRepairValuePct) ? Math.max(10, Math.min(50, input.maxRepairValuePct!)) : 35;
  const gaps: string[] = [];
  const since = today.getTime() - 90 * 86400000;
  const recent = (time: unknown) => timestamp(time) >= since && timestamp(time) <= today.getTime();
  const jobs = bookings.filter(b => recent(b.createdAt));
  const paidRepairs = jobs.filter(b => b.invoice?.paymentStatus && b.invoice.paymentStatus !== 'unpaid');
  const paidSales = sales.filter(s => (!s.status || s.status === 'completed') && s.paymentMethod !== 'unpaid' && recent(s.createdAt));
  const counts = new Map<string, number>();
  for (const s of paidSales) {
    // Identifiers are used only for local grouping and are never included in the brief.
    const id = s.customerId || s.membershipNumber;
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  }
  const groups = new Map<string, StrategySegment>();
  const seen = new Set<string>();
  for (const user of input.users || []) {
    if (user.role !== 'customer') continue;
    for (const bike of user.bikes || []) {
      const key = `${user.uid}:${bike.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const details = bike.bikeDetails || {};
      const price = details.purchasePriceGbp;
      const known = typeof price === 'number' && Number.isFinite(price) && price > 0;
      const style: RidingStyle = RIDING_STYLES.includes(details.ridingStyle as RidingStyle) ? details.ridingStyle as RidingStyle : bike.category === 'electric_scooter' ? 'scooter' : 'unknown';
      const band = !known ? 'unknown-value' : price <= 50 ? 'up-to-50' : price <= 100 ? '51-to-100' : price <= 300 ? '101-to-300' : price <= 750 ? '301-to-750' : 'over-750';
      const id = `${bike.category}:${style}:${band}`;
      const spend = affordableSpend(price, details.repairBudgetGbp, percent);
      const group = groups.get(id) || { id, label: `${style === 'unknown' ? 'Unspecified style' : style} · ${bike.category} · ${band.replaceAll('-', ' ')}`, category: bike.category, style, count: 0, knownValues: 0, lowestPurchasePriceGbp: null, maxSpendGbp: null };
      group.count++;
      if (known) {
        group.knownValues++;
        group.lowestPurchasePriceGbp = Math.min(group.lowestPurchasePriceGbp ?? Infinity, price);
        group.maxSpendGbp = Math.min(group.maxSpendGbp ?? Infinity, spend!);
      }
      groups.set(id, group);
    }
  }
  const segments = [...groups.values()].sort((a, b) => (a.lowestPurchasePriceGbp ?? Infinity) - (b.lowestPurchasePriceGbp ?? Infinity));
  const knownCount = segments.reduce((sum, s) => sum + s.knownValues, 0);
  if (!seen.size) gaps.push('No customer bikes loaded. Ask about bike value, style and budget before targeting a priced offer.');
  else if (knownCount < seen.size) gaps.push(`${seen.size - knownCount} of ${seen.size} bikes have no owner-reported purchase price. Quote-first only for these bikes.`);
  if (segments.some(s => s.style === 'unknown')) gaps.push('Some riding styles are unrecorded; do not infer them from brand or price.');
  if (jobs.length + paidSales.length < 10) gaps.push('Fewer than 10 recent bookings and paid sales: behaviour evidence is limited.');
  gaps.push('Job costs and spare workshop capacity are not recorded in this brief; margins require staff review.');
  const services = catalogueServices(input.priceList || []);
  if (!services.length) gaps.push('No unambiguous catalogue prices available; do not invent paid offers.');
  if (!(input.products || []).some(p => Number.isSafeInteger(p.stock) && p.stock > 0 && Number.isFinite(p.price) && p.price > 0)) gaps.push('No in-stock catalogue products recorded. Stock campaigns cannot be approved until stock and pricing are available.');
  const forecast = weather && !weather.synthetic && today.getTime() - weather.fetchedAt <= 24 * 3600000 && today.getTime() >= weather.fetchedAt && weather.location.label.toLowerCase().includes('salford') ? weather.days.filter(d => d.date.startsWith(month) && d.date >= today.toISOString().slice(0, 10)) : [];
  const season = Number(month.slice(5));
  const seasonal = season <= 2 || season === 12 ? 'Winter planning assumption: cold, shorter days and wet journeys may favour visibility and battery-care advice.' : season <= 5 ? 'Spring planning assumption: riders may return after winter; check condition before suggesting work.' : season <= 8 ? 'Summer planning assumption: leisure and family riding may increase; do not assume dry weather.' : 'Autumn planning assumption: shorter days and wet journeys may favour lights, brakes and mudguard checks.';
  const weatherBrief: PromotionStrategy['weather'] = forecast.length ? {
    basis: 'forecast', location: weather!.location.label,
    coverage: `${forecast[0].date} to ${forecast[forecast.length - 1].date}`,
    summary: `${forecast.filter(d => d.precipProb >= 60 || d.precipMm >= 1).length}/${forecast.length} forecast days have rain risk; minimum ${Math.min(...forecast.map(d => d.tempMin))}°C; maximum wind ${Math.max(...forecast.map(d => d.windMaxKph))} km/h. Outside this window: ${seasonal}`,
  } : { basis: 'seasonal', location: 'Salford', coverage: 'No fresh forecast covering this month', summary: seasonal };
  if (!forecast.length) gaps.push('Fresh Salford weather is unavailable for this month; seasonal assumptions are not a forecast.');
  if (!input.officialEvents) gaps.push('Bank holidays use recurring calendar rules; verify exceptional dates and opening hours.');
  return {
    month, maxRepairValuePct: percent, events: monthEvents(month, input.officialEvents), calendarVerified: Boolean(input.officialEvents), weather: weatherBrief,
    behaviour: { since: new Date(since).toISOString().slice(0, 10), until: today.toISOString().slice(0, 10), bookings: jobs.length,
      completedRepairs: paidRepairs.length, declinedQuotes: jobs.filter(b => b.approvalStatus === 'declined').length,
      completedSales: paidSales.length, repeatCustomers: [...counts.values()].filter(n => n >= 2).length,
      medianPaidRepairGbp: median(paidRepairs.map(b => b.invoice!.grandTotal)), medianPaidSaleGbp: median(paidSales.map(s => s.grandTotal)) },
    products: (input.products || []).filter(p => Number.isFinite(p.price) && p.price > 0 && Number.isSafeInteger(p.stock) && p.stock > 0).map(p => ({id:p.id, title:p.name, category:p.category, priceGbp:p.price, stock:p.stock})),
    objectives: ['workshop','stock','retention','growth'],
    segments, services, gaps, staffNotes: (input.staffNotes || '').slice(0, 1000), targets: input.targets || {},
  };
}

export async function fetchOfficialHolidays(): Promise<{ title: string; date: string }[] | undefined> {
  try {
    const response = await fetch('https://www.gov.uk/bank-holidays.json', { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return undefined;
    const json = await response.json();
    const events = json?.['england-and-wales']?.events;
    return Array.isArray(events) ? events.filter(e => typeof e?.title === 'string' && typeof e?.date === 'string').map(e => ({ title: e.title, date: e.date })) : undefined;
  } catch { return undefined; }
}
