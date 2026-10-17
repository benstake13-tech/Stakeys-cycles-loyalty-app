import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { useWebsiteContent } from '../context/WebsiteContentStore';
import { advisePromotion } from '../api/promotionAdvisorService';
import { buildPromotionBrief, type AdvisorAction, type AdvisorResult } from '../utils/promotionAdvisor';
import { fetchOfficialHolidays, londonMonth } from '../utils/promotionStrategyContext';
import { fetchWeatherReport, loadCachedWeather, DEFAULT_WEATHER_LOCATION, type WeatherReport } from '../utils/weatherService';
import { CAMPAIGN_GOALS } from '../utils/promotionLogistics';
import { validMonth } from '../../supabase/functions/_shared/promotionStrategy';

const field = 'mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none';
const gbp = (value: number) => new Intl.NumberFormat('en-GB', {style:'currency', currency:'GBP', maximumFractionDigits:2}).format(value);

/** Both entry points use exactly the same evidence, instructions and price checks. */
export function PromotionAdvisorPanel({ weather: suppliedWeather, targets = {}, onApply }: {
  weather?: WeatherReport | null; targets?: Record<string, unknown>; onApply?: (action: AdvisorAction) => void;
}) {
  const { promotions = [], discountCodes = [], bookings = [], sales = [], users = [] } = useShop();
  const catalogue = useWebsiteContent();
  const [now, setNow] = useState(() => new Date());
  const [month, setMonth] = useState(() => londonMonth());
  const [percent, setPercent] = useState(35);
  const [notes, setNotes] = useState('');
  const [weather, setWeather] = useState<WeatherReport | null>(() => loadCachedWeather());
  const [official, setOfficial] = useState<{title:string;date:string}[] | undefined>();
  const [advice, setAdvice] = useState<AdvisorResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copiedCaption, setCopiedCaption] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void fetchOfficialHolidays().then(events => { if (mounted.current) setOfficial(events); });
    if (suppliedWeather === undefined) void fetchWeatherReport(DEFAULT_WEATHER_LOCATION).then(w => { if (mounted.current) setWeather(w); }).catch(() => {});
    return () => { mounted.current = false; };
  }, []);
  const options = {month, maxRepairValuePct:percent, staffNotes:notes, users, priceList:catalogue.priceList || [], products:catalogue.products || [], officialEvents:official, targets};
  const brief = useMemo(() => buildPromotionBrief(promotions, discountCodes, now, suppliedWeather === undefined ? weather : suppliedWeather, bookings, sales, options), [promotions, discountCodes, now, suppliedWeather, weather, bookings, sales, users, catalogue.priceList, catalogue.products, official, month, percent, notes, targets]);
  const context = brief.strategy;
  const recorded = context.segments.reduce((sum,s) => sum+s.count,0);
  const valued = context.segments.reduce((sum,s) => sum+s.knownValues,0);
  const reset = () => { setAdvice(null); setError(''); };
  const copyCaption = async (id: string, caption: string) => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopiedCaption(id);
      window.setTimeout(() => setCopiedCaption(current => current === id ? null : current), 1800);
    } catch {
      setError('Could not copy the post. Select the caption and copy it manually.');
    }
  };
  const captions = [
    {
      id: 'intro',
      label: 'Introduce the shop',
      text: `Hello Salford 👋 We’re Stakey’s Cycles, your local place for bike and e-scooter servicing, repairs and advice.\n\nGot a bike that needs some attention? Send us a photo or message to ask what to do next. We’ll explain the options and agree a quote before any work starts.\n\n📍 Salford\n📞 Call or message us to get started\n\n#Salford #SalfordBusiness #Cycling #StakeysCycles`,
    },
    {
      id: 'workshop',
      label: 'Show useful workshop work',
      text: `A little workshop care can make the next ride feel much better 🚲\n\nThis week at Stakey’s Cycles, we’re sharing simple bike-care tips and showing the repairs that help local riders keep moving. Have a question about your bike? Message us for friendly advice and a clear quote.\n\n📍 Proud to serve Salford\n\n#Salford #BikeRepair #CyclingTips #StakeysCycles`,
    },
  ];
  const run = async () => {
    if (busy || !validMonth(month)) return;
    setBusy(true); reset();
    const at = new Date(); setNow(at);
    try {
      const result = await advisePromotion(buildPromotionBrief(promotions, discountCodes, at, suppliedWeather === undefined ? weather : suppliedWeather, bookings, sales, options));
      if (mounted.current) setAdvice(result);
    } catch { if (mounted.current) setError('Could not prepare the brief. Try again.'); }
    finally { if (mounted.current) setBusy(false); }
  };
  return <section data-testid="promo-advisor" className="rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-950/40 to-neutral-950/80 p-4 sm:p-5 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-400">Stakey’s growth studio</p><h3 className="mt-1 text-lg font-bold text-white">AI promotion planner</h3><p className="mt-1 max-w-xl text-xs text-neutral-400">Balance quiet workshop slots, available stock, repeat visits and new customers. Check the month, weather, riding needs and spending limits before preparing campaign briefs.</p></div>
      <Sparkles size={24} className="text-emerald-400" aria-hidden="true" />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs text-neutral-300">Planning month<input aria-label="Planning month" type="month" min={londonMonth(now)} value={month} disabled={busy} onChange={e => { setMonth(e.target.value); reset(); }} className={field}/></label>
      <label className="text-xs text-neutral-300">Repair planning ceiling<select aria-label="Repair planning ceiling" value={percent} disabled={busy} onChange={e => {setPercent(Number(e.target.value));reset();}} className={field}>{[20,25,30,35,40,50].map(p => <option key={p} value={p}>{p}% of the price paid</option>)}</select></label>
    </div>
    <p className="rounded-xl bg-emerald-400/5 p-3 text-xs leading-relaxed text-emerald-100">At this setting, a bike bought for £30 has a planning ceiling of {gbp(Math.floor(30 * percent / 100))}. An owner’s lower repair budget takes priority. This is a guide for relevant offers; always agree the actual work and total with the customer.</p>
    <label className="block text-xs text-neutral-300">Workshop facts to consider<textarea value={notes} disabled={busy} maxLength={1000} rows={2} onChange={e => {setNotes(e.target.value);reset();}} className={field} placeholder="e.g. spare Tuesday slots, tyre stock to move, services we cannot offer this month"/></label>
    <details data-testid="promo-starter-guide" className="rounded-2xl border border-sky-300/20 bg-sky-950/20 p-4">
      <summary className="cursor-pointer text-sm font-bold text-sky-100">New to promoting the shop? Start with this simple plan</summary>
      <div className="mt-4 space-y-4 text-xs leading-relaxed text-neutral-300">
        <p>Build local awareness before spending heavily on discounts. Pick one clear message, show real work with permission, and make it easy for people to ask a question or book.</p>
        <ol className="grid gap-2 sm:grid-cols-2">
          {[
            ['Week 1 · Be findable', 'Check your Google Business Profile details, opening hours, phone and map pin. Add a clear workshop photo and a direct booking or message link.'],
            ['Week 2 · Show the work', 'Post a short before-and-after or a 20-second repair tip on Facebook and Instagram. Explain the problem and the result in plain language.'],
            ['Week 3 · Meet local riders', 'Share a useful offer or maintenance tip in relevant Salford community groups where business posts are allowed. Answer questions helpfully; avoid repetitive posting.'],
            ['Week 4 · Learn what worked', 'Ask every new customer how they found you. Track enquiries, bookings and completed paid jobs by channel before repeating or paying to boost a post.'],
          ].map(([title, detail]) => <li key={title} className="list-none rounded-xl border border-white/10 bg-black/20 p-3"><strong className="block text-sky-200">{title}</strong><span>{detail}</span></li>)}
        </ol>
        <div className="space-y-2">
          <h4 className="font-bold text-white">Ready-to-edit social captions</h4>
          <p>Replace the call-to-action with your preferred phone number or booking link. Only share customer bikes or faces when you have permission.</p>
          {captions.map(caption => <article key={caption.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-2"><strong className="text-emerald-200">{caption.label}</strong><button type="button" onClick={() => void copyCaption(caption.id, caption.text)} className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-[11px] font-semibold text-white">{copiedCaption === caption.id ? <Check size={13}/> : <Copy size={13}/>} {copiedCaption === caption.id ? 'Copied' : 'Copy caption'}</button></div>
            <p className="whitespace-pre-line text-neutral-300">{caption.text}</p>
          </article>)}
        </div>
        <p className="rounded-xl bg-emerald-400/5 p-3 text-emerald-100">When you have created and approved a promotion below, use <strong>Business Performance → Promote to Social</strong> to review its post and publish it to the connected Facebook Page or Instagram account. Posting requires the existing Meta connection to be configured.</p>
      </div>
    </details>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
      {[['Bike values', `${valued}/${recorded} recorded`],['Paid sales · 90 days',context.behaviour.completedSales],['Paid repairs · 90 days',context.behaviour.completedRepairs],['Weather',context.weather.basis === 'forecast' ? 'Dated local forecast' : 'Seasonal assumptions']].map(([label,value]) => <div key={label} className="rounded-xl border border-white/5 bg-black/20 p-3"><span className="block text-neutral-400">{label}</span><strong className="mt-1 block text-white">{value}</strong></div>)}
    </div>
    <details className="rounded-xl border border-white/10 p-3 text-xs">
      <summary className="cursor-pointer font-semibold text-emerald-200">Evidence &amp; generation rules</summary>
      <div className="mt-3 space-y-3 text-neutral-300">
        <p><strong>Occasions this month:</strong> {context.events.length ? context.events.map(e => `${e.label} · ${e.date}`).join(' / ') : 'None in the calendar.'} {context.calendarVerified ? 'Bank holidays checked against GOV.UK.' : 'Recurring dates; verify exceptional holidays.'}</p>
        <p><strong>Salford weather:</strong> {context.weather.coverage}. {context.weather.summary}</p>
        <p><strong>Behaviour:</strong> {context.behaviour.since} to {context.behaviour.until}; {context.behaviour.repeatCustomers} customers with repeat paid sales; {context.behaviour.declinedQuotes} declined booking quotes. Declines do not prove price sensitivity.</p>
        <p><strong>Bike fit:</strong> commuter, mountain, road, gravel, hybrid, kids, cargo and scooter needs are kept distinct. Brand and original retail price are never used as a spending budget.</p>
        <p><strong>Pricing:</strong> real catalogue prices; discounts capped at 20%; unknown values mean quote-first. Parts, labour costs and capacity must be checked. No automatic publishing or customer messages.</p>
        {context.segments.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="p-2">Rider group</th><th className="p-2">Bikes</th><th className="p-2">Lowest price paid</th><th className="p-2">Planning ceiling</th></tr></thead><tbody>{context.segments.map(s => <tr key={s.id} className="border-t border-white/10"><td className="p-2">{s.label}</td><td className="p-2">{s.count}</td><td className="p-2">{s.lowestPurchasePriceGbp === null ? 'Unknown' : gbp(s.lowestPurchasePriceGbp)}</td><td className="p-2">{s.maxSpendGbp === null ? 'Quote first' : gbp(s.maxSpendGbp)}</td></tr>)}</tbody></table></div>}
        <ul className="list-disc pl-4 space-y-1">{context.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>
        <p>Add purchase price, budget and riding style under a customer’s bike details to improve the next brief.</p>
      </div>
    </details>
    <button type="button" data-testid="promo-advisor-run" onClick={() => void run()} disabled={busy || !validMonth(month) || month < londonMonth(now)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-neutral-950 disabled:opacity-50 sm:w-auto">{busy ? <Loader2 size={17} className="animate-spin"/> : <Sparkles size={17}/>} {busy ? 'Preparing relevant offers…' : 'Suggest promotions'}</button>
    {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
    {advice && <div data-testid="promo-advisor-result" aria-live="polite" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-emerald-200">{advice.headline}</h4><span data-testid="promo-advisor-source" className="rounded-full border border-white/15 px-2 py-1 text-[10px] text-neutral-300">{advice.source === 'ai' ? 'AI' : 'Offline'}</span></div>
      <div className="grid gap-3 lg:grid-cols-2">{advice.actions.map((a,i) => <article key={i} className="rounded-2xl border border-white/10 bg-black/25 p-4 space-y-3">
        <p className="text-xs font-bold text-emerald-300">{CAMPAIGN_GOALS[a.objective || 'workshop']} · {a.provenance === 'rules' ? 'Rules-based' : advice.source === 'ai' ? 'AI brief' : 'Rules-based'}</p><h4 className="font-bold text-white">{a.title}</h4><p className="text-xs leading-relaxed text-neutral-300">{a.rationale}</p>
        <dl className="space-y-2 text-xs"><div><dt className="font-bold text-emerald-300">Who it suits</dt><dd>{a.audienceDescription || 'Confirm rider needs and budget'}</dd></div><div><dt className="font-bold text-emerald-300">Spending fit</dt><dd>{a.offerPriceGbp !== undefined ? `${gbp(a.offerPriceGbp)} catalogue estimate${a.spendCeilingGbp !== undefined ? ` · ${gbp(a.spendCeilingGbp)} total planning ceiling` : ''}` : 'Quote first — no price promised'}</dd><dd className="mt-1 text-neutral-400">{a.priceBasis}</dd></div><div><dt className="font-bold text-emerald-300">Timing &amp; channel</dt><dd>{a.startDate} → {a.endDate} · {a.channel || 'In-store discussion'}</dd></div><div><dt className="font-bold text-emerald-300">Measure</dt><dd>{a.successMetric || 'Enquiries and accepted quotes'}</dd></div></dl>
        {a.evidence?.length ? <ul className="list-disc pl-4 text-xs text-neutral-400">{a.evidence.map((e,j) => <li key={j}>{e}</li>)}</ul> : null}
        {a.checks?.length ? <details className="text-xs text-amber-100"><summary className="cursor-pointer">Checks before approval</summary><ul className="mt-2 list-disc pl-4">{a.checks.map((c,j) => <li key={j}>{c}</li>)}</ul></details> : null}
        {onApply && <button type="button" data-testid={`promo-advisor-apply-${i}`} onClick={() => onApply(a)} className="w-full rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200">Load into draft</button>}
      </article>)}</div>
      <p className="text-xs text-neutral-400">{advice.notes || 'Campaign briefs need staff approval. No offer has been published.'}</p>
    </div>}
  </section>;
}
